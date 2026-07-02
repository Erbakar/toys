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

export class ApiDetectionService implements IDetectionService {
  private readonly baseUrl: string;

  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
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
   * Etiket + konum tabanlı eşleştirme.
   *
   * Her deteksiyonda nesnelere yeni UUID atandığından ID veya renk histogramı
   * güvenilir değil. Aynı sahnede kamera sabitken iki fotoğraf karşılaştırılıyor;
   * dolayısıyla aynı etiket + yakın konum = aynı fiziksel nesne.
   *
   * Algoritma:
   *  1. Her kontrol nesnesini, aynı etikete sahip referans nesneleriyle karşılaştır.
   *  2. Normalize bbox merkez mesafesini hesapla (0 = üst üste, 1 = köşe köşe).
   *  3. Mesafe < MAX_CENTER_DIST ise eşleşme sayılır; en yakın eşleşme kazanır.
   *  4. Eşleşemeyen kontrol nesnesi → added, eşleşemeyen referans nesnesi → removed.
   */
  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff {
    return this.compareByLabelAndPosition(reference.objects, current.objects);
  }

  // ── Özel eşleştirme yöntemi ───────────────────────────────────────────────

  private compareByLabelAndPosition(
    refObjects: DetectedObject[],
    curObjects: DetectedObject[],
  ): DetectionDiff {
    /** Kamera hafif hareket etse bile eşleşsin diye %25 tolerans. */
    const MAX_CENTER_DIST = 0.25;

    const matched = new Set<string>();
    const unchanged: DetectedObject[] = [];
    const added: DetectedObject[] = [];

    for (const cur of curObjects) {
      const curCx = cur.boundingBox.x + cur.boundingBox.width  / 2;
      const curCy = cur.boundingBox.y + cur.boundingBox.height / 2;

      let bestDist = Infinity;
      let bestRefId: string | null = null;

      for (const ref of refObjects) {
        if (matched.has(ref.id)) continue;
        if (ref.label !== cur.label) continue;

        const refCx = ref.boundingBox.x + ref.boundingBox.width  / 2;
        const refCy = ref.boundingBox.y + ref.boundingBox.height / 2;
        const dist  = Math.sqrt((refCx - curCx) ** 2 + (refCy - curCy) ** 2);

        if (dist < bestDist) {
          bestDist  = dist;
          bestRefId = ref.id;
        }
      }

      if (bestRefId !== null && bestDist <= MAX_CENTER_DIST) {
        matched.add(bestRefId);
        unchanged.push(cur);
      } else {
        added.push(cur);
      }
    }

    return {
      added,
      removed:   refObjects.filter((r) => !matched.has(r.id)),
      unchanged,
    };
  }
}
