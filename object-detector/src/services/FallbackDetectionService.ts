import type {
  DetectionDiff,
  DetectionResult,
  IDetectionService,
} from '../types/detection';

export class FallbackDetectionService implements IDetectionService {
  private readonly primary: IDetectionService;
  private readonly fallback: IDetectionService;

  constructor(primary: IDetectionService, fallback: IDetectionService) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async detect(imageDataUrl: string): Promise<DetectionResult> {
    try {
      return await this.primary.detect(imageDataUrl);
    } catch (err) {
      if (!import.meta.env.PROD) {
        throw err;
      }

      console.warn('API detection failed; using mock fallback.', err);
      return this.fallback.detect(imageDataUrl);
    }
  }

  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff {
    return this.primary.compare(reference, current);
  }

  async compareDetailed(
    reference: DetectionResult,
    current: DetectionResult,
  ): Promise<DetectionDiff> {
    try {
      return await this.primary.compareDetailed?.(reference, current) ?? this.primary.compare(reference, current);
    } catch (err) {
      if (!import.meta.env.PROD) {
        throw err;
      }

      return this.fallback.compare(reference, current);
    }
  }
}
