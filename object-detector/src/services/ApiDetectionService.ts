import type {
  DetectedObject,
  DetectionResult,
  DetectionDiff,
  IDetectionService,
} from '../types/detection';

// ─── API Kontratı ────────────────────────────────────────────────────────────

interface DetectRequest {
  image: string; // data URL (data:image/jpeg;base64,...)
}

interface DetectResponse {
  imageId: string;
  objects: DetectedObject[]; // Backend doğrudan frontend tipiyle uyumlu döner
}

// ─── Yardımcı ────────────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Servis ──────────────────────────────────────────────────────────────────

export class ApiDetectionService implements IDetectionService {
  private readonly baseUrl: string;
  /**
   * Embedding tabanlı eşleştirmede eşik değer (0–1).
   * İki nesnenin "aynı" sayılması için minimum cosine similarity.
   */
  private readonly similarityThreshold: number;

  constructor(
    baseUrl = 'http://localhost:8000',
    similarityThreshold = 0.85,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.similarityThreshold = similarityThreshold;
  }

  // ── detect ────────────────────────────────────────────────────────────────

  async detect(imageDataUrl: string): Promise<DetectionResult> {
    const body: DetectRequest = { image: imageDataUrl };

    const res = await fetch(`${this.baseUrl}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

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

  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff {
    const ref = reference.objects;
    const cur = current.objects;

    const hasEmbeddings =
      ref.every((o) => o.featureEmbedding && o.featureEmbedding.length > 0) &&
      cur.every((o) => o.featureEmbedding && o.featureEmbedding.length > 0);

    return hasEmbeddings
      ? this.compareByEmbedding(ref, cur)
      : this.compareById(ref, cur);
  }

  // ── Özel eşleştirme yöntemleri ────────────────────────────────────────────

  /**
   * CLIP embedding tabanlı eşleştirme.
   * Her kontrol nesnesini referans nesneleriyle cosine similarity üzerinden
   * karşılaştırır; eşleşme bulunamazsa "yeni nesne" olarak işaretler.
   * Backend modeli veya etiket formatı değişse bile doğru çalışır.
   */
  private compareByEmbedding(
    refObjects: DetectedObject[],
    curObjects: DetectedObject[],
  ): DetectionDiff {
    const matched = new Set<string>();
    const unchanged: DetectedObject[] = [];
    const added: DetectedObject[] = [];

    for (const cur of curObjects) {
      let bestScore = -1;
      let bestRefId: string | null = null;

      for (const ref of refObjects) {
        if (matched.has(ref.id)) continue;
        const score = cosineSimilarity(cur.featureEmbedding!, ref.featureEmbedding!);
        if (score > bestScore) {
          bestScore = score;
          bestRefId = ref.id;
        }
      }

      if (bestRefId !== null && bestScore >= this.similarityThreshold) {
        matched.add(bestRefId);
        unchanged.push(cur);
      } else {
        added.push(cur);
      }
    }

    return {
      added,
      removed: refObjects.filter((r) => !matched.has(r.id)),
      unchanged,
    };
  }

  /** ID tabanlı basit eşleştirme — embedding yoksa devreye girer. */
  private compareById(
    refObjects: DetectedObject[],
    curObjects: DetectedObject[],
  ): DetectionDiff {
    const refIds = new Set(refObjects.map((o) => o.id));
    const curIds = new Set(curObjects.map((o) => o.id));

    return {
      removed:   refObjects.filter((o) => !curIds.has(o.id)),
      added:     curObjects.filter((o) => !refIds.has(o.id)),
      unchanged: curObjects.filter((o) =>  refIds.has(o.id)),
    };
  }
}
