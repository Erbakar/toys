import type {
  DetectedObject,
  DetectionResult,
  DetectionDiff,
  IDetectionService,
  ModifiedObject,
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

interface CompareResponse {
  added: DetectedObject[];
  removed: DetectedObject[];
  unchanged: DetectedObject[];
  modified: ModifiedObject[];
  aiFindings?: DetectionDiff['aiFindings'];
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

    let lastError: Error | null = null;

    // Render free tier: ilk istekte uyku/cold start olabilir — bir kez daha dene
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 4000));
      }

      let res: Response;
      try {
        res = await fetch(`${this.baseUrl}/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch {
        lastError = new Error(
          `API sunucusuna ulaşılamıyor (${this.baseUrl}). Render servisi uyuyor olabilir — 1 dk bekleyip tekrar deneyin.`,
        );
        continue;
      }

      if (res.status === 502 || res.status === 503) {
        lastError = new Error(
          'Backend henüz hazır değil (502). Render servisi uyanıyor — birkaç saniye sonra tekrar deneyin.',
        );
        continue;
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

    throw lastError ?? new Error('Nesne algılama başarısız oldu.');
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

  async compareDetailed(
    reference: DetectionResult,
    current: DetectionResult,
  ): Promise<DetectionDiff> {
    const [referenceImage, currentImage] = await Promise.all([
      compressImageForApi(reference.imageUrl),
      compressImageForApi(current.imageUrl),
    ]);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referenceImage, currentImage }),
      });
    } catch {
      return this.compare(reference, current);
    }

    if (!res.ok) {
      return this.compare(reference, current);
    }

    const data: CompareResponse = await res.json();
    return {
      added: data.added,
      removed: data.removed,
      unchanged: data.unchanged,
      modified: data.modified,
      aiFindings: data.aiFindings ?? [],
    };
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
    const modified: ModifiedObject[] = [];

    for (const candidate of candidates) {
      if (matchedRef.has(candidate.ref.id) || matchedCur.has(candidate.cur.id)) continue;
      matchedRef.add(candidate.ref.id);
      matchedCur.add(candidate.cur.id);

      const visualSimilarity = this.embeddingSimilarity(
        candidate.ref.featureEmbedding,
        candidate.cur.featureEmbedding,
      );
      const sizeSimilarity = this.sizeSimilarity(candidate.ref, candidate.cur);
      const reason = this.getModificationReason(candidate.ref, visualSimilarity, sizeSimilarity);

      if (reason) {
        modified.push({
          reference: candidate.ref,
          current: candidate.cur,
          reason,
          score: candidate.score,
          visualSimilarity,
          sizeSimilarity,
        });
      } else {
        unchanged.push(candidate.cur);
      }
    }

    return {
      added: curObjects.filter((obj) => !matchedCur.has(obj.id)),
      removed: refObjects.filter((obj) => !matchedRef.has(obj.id)),
      unchanged,
      modified,
      aiFindings: [],
    };
  }

  private matchScore(ref: DetectedObject, cur: DetectedObject): number {
    if (ref.label !== cur.label) return 0;
    if (ref.dominantColor && cur.dominantColor && ref.dominantColor !== cur.dominantColor) {
      return 0;
    }

    const dist = this.centerDistance(ref, cur);
    const position = Math.max(0, 1 - Math.min(dist / 0.5, 1));
    const iou = this.iou(ref, cur);
    const size = this.sizeSimilarity(ref, cur);
    const visual = this.embeddingSimilarity(ref.featureEmbedding, cur.featureEmbedding);
    const colorBonus = ref.dominantColor && ref.dominantColor === cur.dominantColor ? 1 : 0;

    return 0.35 * position + 0.22 * iou + 0.2 * visual + 0.15 * size + 0.08 * colorBonus;
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

  private getModificationReason(
    ref: DetectedObject,
    visualSimilarity: number,
    sizeSimilarity: number,
  ): string | null {
    const label = ref.label.toLowerCase();
    const partSensitive =
      label.includes('person') ||
      label.includes('bear') ||
      label.includes('doll') ||
      label.includes('figure') ||
      label.includes('teddy');

    if (partSensitive && (visualSimilarity < 0.78 || sizeSimilarity < 0.72)) {
      return 'Görünümü değişmiş; parça veya uzuv eksik olabilir.';
    }

    if (visualSimilarity < 0.68) {
      return 'Renk veya yüzey görünümü belirgin değişmiş.';
    }

    if (sizeSimilarity < 0.62) {
      return 'Boyutu/kapladığı alan belirgin değişmiş.';
    }

    return null;
  }
}
