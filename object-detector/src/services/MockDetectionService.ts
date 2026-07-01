import type {
  DetectedObject,
  DetectionResult,
  DetectionDiff,
  IDetectionService,
} from '../types/detection';

const OBJECT_POOL: Omit<DetectedObject, 'id'>[] = [
  {
    label: 'Hot Wheels Kırmızı Araba',
    confidence: 0.97,
    boundingBox: { x: 0.05, y: 0.1, width: 0.12, height: 0.08 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Hot Wheels Mavi Araba',
    confidence: 0.95,
    boundingBox: { x: 0.2, y: 0.15, width: 0.11, height: 0.07 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Sarı Top',
    confidence: 0.93,
    boundingBox: { x: 0.35, y: 0.3, width: 0.09, height: 0.09 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Mavi Lego Parçası',
    confidence: 0.91,
    boundingBox: { x: 0.5, y: 0.2, width: 0.08, height: 0.06 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Kırmızı Zar',
    confidence: 0.98,
    boundingBox: { x: 0.65, y: 0.4, width: 0.07, height: 0.07 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Matchbox Yeşil Araba',
    confidence: 0.94,
    boundingBox: { x: 0.75, y: 0.1, width: 0.12, height: 0.08 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Oyuncak Figür',
    confidence: 0.89,
    boundingBox: { x: 0.1, y: 0.5, width: 0.08, height: 0.15 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Anahtarlık',
    confidence: 0.92,
    boundingBox: { x: 0.4, y: 0.6, width: 0.1, height: 0.06 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Turuncu Top',
    confidence: 0.96,
    boundingBox: { x: 0.6, y: 0.65, width: 0.09, height: 0.09 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Sarı Lego Parçası',
    confidence: 0.88,
    boundingBox: { x: 0.8, y: 0.55, width: 0.08, height: 0.06 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Hot Wheels Turuncu Araba',
    confidence: 0.96,
    boundingBox: { x: 0.25, y: 0.7, width: 0.12, height: 0.08 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
  {
    label: 'Yeşil Top',
    confidence: 0.9,
    boundingBox: { x: 0.55, y: 0.8, width: 0.09, height: 0.09 },
    featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
  },
];

let callCount = 0;

function pickObjects(count: number, startIndex = 0): DetectedObject[] {
  const pool = [...OBJECT_POOL];
  const picked = pool.slice(startIndex, startIndex + count);
  return picked.map((obj, i) => ({
    ...obj,
    id: `obj-${startIndex + i}`,
  }));
}

function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockDetectionService implements IDetectionService {
  private referenceObjects: DetectedObject[] | null = null;

  async detect(imageDataUrl: string): Promise<DetectionResult> {
    await simulateDelay(1200 + Math.random() * 600);

    callCount++;

    let objects: DetectedObject[];

    if (callCount % 2 === 1) {
      // Reference detection: pick 12 objects
      objects = pickObjects(12, 0);
      this.referenceObjects = objects;
    } else {
      // Control detection: remove 3 random objects, add 1 new object
      if (this.referenceObjects) {
        const shuffled = [...this.referenceObjects].sort(() => Math.random() - 0.5);
        const kept = shuffled.slice(0, 9);
        const newObj: DetectedObject = {
          ...OBJECT_POOL[11],
          id: 'obj-new-1',
          featureEmbedding: Array.from({ length: 8 }, () => Math.random()),
        };
        objects = [...kept, newObj];
      } else {
        objects = pickObjects(9, 0);
      }
    }

    return {
      objects,
      imageUrl: imageDataUrl,
      timestamp: Date.now(),
    };
  }

  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff {
    const refIds = new Set(reference.objects.map((o) => o.id));
    const curIds = new Set(current.objects.map((o) => o.id));

    const removed = reference.objects.filter((o) => !curIds.has(o.id));
    const added = current.objects.filter((o) => !refIds.has(o.id));
    const unchanged = current.objects.filter((o) => refIds.has(o.id));

    return { added, removed, unchanged };
  }
}

export const detectionService: IDetectionService = new MockDetectionService();
