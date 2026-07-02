import type {
  DetectedObject,
  DetectionResult,
  DetectionDiff,
  IDetectionService,
} from '../types/detection';
import { compressImageForApi } from '../utils/imageUtils';

// ─── API Kontratı ────────────────────────────────────────────────────────────

interface DetectRequest {
  image: string; // data URL (data:image/jpeg;base64,...)
}

interface DetectResponse {
  imageId: string;
  objects: DetectedObject[]; // Backend doğrudan frontend tipiyle uyumlu döner
}

// ─── Servis ──────────────────────────────────────────────────────────────────

function resolveApiBaseUrl(baseUrl: string): string {
  const fallback = 'http://localhost:8000';

  try {
    const url = new URL(baseUrl || fallback);
    const pageHost = window.location.hostname;
    const apiHostIsLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    const pageHostIsLocal = ['localhost', '127.0.0.1', '::1'].includes(pageHost);

    if (apiHostIsLocal && pageHost && !pageHostIsLocal) {
      url.hostname = pageHost;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export class ApiDetectionService implements IDetectionService {
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = resolveApiBaseUrl(baseUrl);
  }

  // ── detect ────────────────────────────────────────────────────────────────

  async detect(imageDataUrl: string): Promise<DetectionResult> {
    const compressed = await compressImageForApi(imageDataUrl);
    const body: DetectRequest = { image: compressed };

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error(
        `API sunucusuna ulaşılamıyor (${this.baseUrl}). Backend ve tunnel çalışıyor mu?`,
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => res.statusText);
      throw new Error(`API hatası ${res.status}: ${detail}`);
    }

    const data: DetectResponse = await res.json();

    return {
      objects: data.objects,
      imageUrl: imageDataUrl,
      timestamp: Date.now(),
    };
  }

  // ── compare ───────────────────────────────────────────────────────────────

  /**
   * Etiket + konum + IoU + görsel embedding tabanlı eşleştirme.
   *
   * Her deteksiyonda nesnelere yeni UUID atandığından ID veya renk histogramı
   * tek başına güvenilir değil. Aynı sahnede kamera sabitken iki fotoğraf
   * karşılaştırılıyor; dolayısıyla aynı etiket + yakın konum + benzer boyut +
   * benzer renk histogramı = aynı fiziksel nesne.
   *
   * Algoritma:
   *  1. Aynı etikete sahip tüm referans/kontrol çiftleri skorlanır.
   *  2. Skor; merkez yakınlığı, bbox IoU, alan benzerliği ve embedding cosine
   *     benzerliğinin ağırlıklı toplamıdır.
   *  3. En yüksek skorlu çiftlerden başlayarak bire-bir eşleşme yapılır.
   *  4. Eşleşemeyen kontrol nesnesi added, referans nesnesi removed sayılır.
   */
  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff {
    return this.compareBySimilarity(reference.objects, current.objects);
  }

  // ── Özel eşleştirme yöntemi ───────────────────────────────────────────────

  private compareBySimilarity(
    refObjects: DetectedObject[],
    curObjects: DetectedObject[],
  ): DetectionDiff {
    const MIN_MATCH_SCORE = 0.48;
    const candidates: Array<{
      score: number;
      ref: DetectedObject;
      cur: DetectedObject;
    }> = [];

    for (const ref of refObjects) {
      for (const cur of curObjects) {
        const score = this.matchScore(ref, cur);
        if (score >= MIN_MATCH_SCORE) {
          candidates.push({ score, ref, cur });
        }
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const matchedRef = new Set<string>();
    const matchedCur = new Set<string>();
    const unchanged: DetectedObject[] = [];

    for (const candidate of candidates) {
      if (matchedRef.has(candidate.ref.id) || matchedCur.has(candidate.cur.id)) continue;
      matchedRef.add(candidate.ref.id);
      matchedCur.add(candidate.cur.id);
      unchanged.push(candidate.cur);
    }

    return {
      added: curObjects.filter((obj) => !matchedCur.has(obj.id)),
      removed: refObjects.filter((obj) => !matchedRef.has(obj.id)),
      unchanged,
    };
  }

  private matchScore(ref: DetectedObject, cur: DetectedObject): number {
    if (ref.label !== cur.label) return 0;

    const dist = this.centerDistance(ref, cur);
    const position = Math.max(0, 1 - Math.min(dist / 0.5, 1));
    const iou = this.iou(ref, cur);
    const size = this.sizeSimilarity(ref, cur);
    const visual = this.embeddingSimilarity(ref.featureEmbedding, cur.featureEmbedding);

    return 0.4 * position + 0.25 * iou + 0.2 * visual + 0.15 * size;
  }

  private centerDistance(ref: DetectedObject, cur: DetectedObject): number {
    const refCx = ref.boundingBox.x + ref.boundingBox.width / 2;
    const refCy = ref.boundingBox.y + ref.boundingBox.height / 2;
    const curCx = cur.boundingBox.x + cur.boundingBox.width / 2;
    const curCy = cur.boundingBox.y + cur.boundingBox.height / 2;
    return Math.hypot(refCx - curCx, refCy - curCy);
  }

  private iou(ref: DetectedObject, cur: DetectedObject): number {
    const a = ref.boundingBox;
    const b = cur.boundingBox;
    const ax2 = a.x + a.width;
    const ay2 = a.y + a.height;
    const bx2 = b.x + b.width;
    const by2 = b.y + b.height;

    const ix1 = Math.max(a.x, b.x);
    const iy1 = Math.max(a.y, b.y);
    const ix2 = Math.min(ax2, bx2);
    const iy2 = Math.min(ay2, by2);
    const intersection = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
    const union = a.width * a.height + b.width * b.height - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private sizeSimilarity(ref: DetectedObject, cur: DetectedObject): number {
    const refArea = ref.boundingBox.width * ref.boundingBox.height;
    const curArea = cur.boundingBox.width * cur.boundingBox.height;
    const largest = Math.max(refArea, curArea);
    return largest > 0 ? Math.max(0, 1 - Math.abs(refArea - curArea) / largest) : 0;
  }

  private embeddingSimilarity(refEmbedding?: number[], curEmbedding?: number[]): number {
    if (!refEmbedding?.length || !curEmbedding?.length || refEmbedding.length !== curEmbedding.length) {
      return 0.5;
    }

    let dot = 0;
    let refNorm = 0;
    let curNorm = 0;

    for (let i = 0; i < refEmbedding.length; i++) {
      const ref = refEmbedding[i];
      const cur = curEmbedding[i];
      dot += ref * cur;
      refNorm += ref * ref;
      curNorm += cur * cur;
    }

    const denom = Math.sqrt(refNorm) * Math.sqrt(curNorm);
    if (denom <= 0) return 0.5;
    return Math.max(0, Math.min(1, dot / denom));
  }
}
