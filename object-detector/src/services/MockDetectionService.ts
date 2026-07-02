import type {
  DetectedObject,
  DetectionResult,
  DetectionDiff,
  IDetectionService,
} from '../types/detection';

const MOCK_OBJECTS: DetectedObject[] = [
  {
    id: 'mock-car',
    label: 'toy car',
    confidence: 0.92,
    dominantColor: 'red',
    boundingBox: { x: 0.16, y: 0.42, width: 0.24, height: 0.18 },
  },
  {
    id: 'mock-block',
    label: 'lego block',
    confidence: 0.88,
    dominantColor: 'blue',
    boundingBox: { x: 0.48, y: 0.35, width: 0.16, height: 0.15 },
  },
  {
    id: 'mock-ball',
    label: 'ball',
    confidence: 0.84,
    dominantColor: 'yellow',
    boundingBox: { x: 0.68, y: 0.5, width: 0.14, height: 0.14 },
  },
];

export class MockDetectionService implements IDetectionService {
  async detect(_imageDataUrl: string): Promise<DetectionResult> {
    return {
      objects: MOCK_OBJECTS,
      imageUrl: _imageDataUrl,
      timestamp: Date.now(),
    };
  }

  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff {
    const refIds = new Set(reference.objects.map((o) => o.id));
    const curIds = new Set(current.objects.map((o) => o.id));

    return {
      removed:   reference.objects.filter((o) => !curIds.has(o.id)),
      added:     current.objects.filter((o) => !refIds.has(o.id)),
      unchanged: current.objects.filter((o) =>  refIds.has(o.id)),
      modified: [],
      aiFindings: [],
    };
  }

  async compareDetailed(
    reference: DetectionResult,
    current: DetectionResult,
  ): Promise<DetectionDiff> {
    return this.compare(reference, current);
  }
}

export const detectionService: IDetectionService = new MockDetectionService();
