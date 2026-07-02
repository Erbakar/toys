import type {
  DetectionResult,
  DetectionDiff,
  IDetectionService,
} from '../types/detection';

export class MockDetectionService implements IDetectionService {
  async detect(_imageDataUrl: string): Promise<DetectionResult> {
    return {
      objects: [],
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
    };
  }
}

export const detectionService: IDetectionService = new MockDetectionService();
