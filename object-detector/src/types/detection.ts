export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedObject {
  id: string;
  label: string;
  confidence: number;
  boundingBox: BoundingBox;
  featureEmbedding?: number[];
}

export interface DetectionResult {
  objects: DetectedObject[];
  imageUrl: string;
  timestamp: number;
}

export interface DetectionDiff {
  added: DetectedObject[];
  removed: DetectedObject[];
  unchanged: DetectedObject[];
}

export interface IDetectionService {
  detect(imageDataUrl: string): Promise<DetectionResult>;
  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff;
}
