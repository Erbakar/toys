import type {
  DetectedObject,
  DetectionResult,
  DetectionDiff,
  IDetectionService,
} from '../types/detection';
import { dataUrlToBlob } from '../utils/imageUtils';

/** Shape returned by the FastAPI endpoint for each detected object. */
interface ApiObject {
  id: string;
  label: string;
  confidence: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  feature_embedding?: number[];
}

/** Shape returned by POST /detect */
interface ApiResponse {
  objects: ApiObject[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function mapApiObject(obj: ApiObject): DetectedObject {
  return {
    id: obj.id,
    label: obj.label,
    confidence: obj.confidence,
    boundingBox: {
      x: obj.bounding_box.x,
      y: obj.bounding_box.y,
      width: obj.bounding_box.width,
      height: obj.bounding_box.height,
    },
    featureEmbedding: obj.feature_embedding,
  };
}

export class ApiDetectionService implements IDetectionService {
  private readonly baseUrl: string;
  /** Cosine similarity threshold for embedding-based matching (0–1). */
  private readonly similarityThreshold: number;

  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000', similarityThreshold = 0.85) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.similarityThreshold = similarityThreshold;
  }

  async detect(imageDataUrl: string): Promise<DetectionResult> {
    const blob = dataUrlToBlob(imageDataUrl);
    const form = new FormData();
    form.append('file', blob, 'capture.jpg');

    const res = await fetch(`${this.baseUrl}/detect`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API hatası ${res.status}: ${text}`);
    }

    const data: ApiResponse = await res.json();

    return {
      objects: data.objects.map(mapApiObject),
      imageUrl: imageDataUrl,
      timestamp: Date.now(),
    };
  }

  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff {
    const refObjects = reference.objects;
    const curObjects = current.objects;

    const hasEmbeddings =
      refObjects.every((o) => o.featureEmbedding && o.featureEmbedding.length > 0) &&
      curObjects.every((o) => o.featureEmbedding && o.featureEmbedding.length > 0);

    if (hasEmbeddings) {
      return this.compareByEmbedding(refObjects, curObjects);
    }

    return this.compareById(refObjects, curObjects);
  }

  /**
   * Embedding tabanlı eşleştirme: CLIP feature vektörlerini kullanarak
   * referans ve kontrol nesnelerini cosine similarity ile eşleştirir.
   * Backend modeli değişse bile etiket değişimleri doğru yakalanır.
   */
  private compareByEmbedding(
    refObjects: DetectedObject[],
    curObjects: DetectedObject[]
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

    const removed = refObjects.filter((r) => !matched.has(r.id));
    return { added, removed, unchanged };
  }

  /** ID tabanlı basit eşleştirme (embedding yoksa fallback). */
  private compareById(
    refObjects: DetectedObject[],
    curObjects: DetectedObject[]
  ): DetectionDiff {
    const refIds = new Set(refObjects.map((o) => o.id));
    const curIds = new Set(curObjects.map((o) => o.id));

    return {
      removed: refObjects.filter((o) => !curIds.has(o.id)),
      added: curObjects.filter((o) => !refIds.has(o.id)),
      unchanged: curObjects.filter((o) => refIds.has(o.id)),
    };
  }
}
