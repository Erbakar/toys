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
  dominantColor?: string;
  featureEmbedding?: number[];
}

export interface ModifiedObject {
  reference: DetectedObject;
  current: DetectedObject;
  reason: string;
  score: number;
  visualSimilarity: number;
  sizeSimilarity: number;
}

export interface AiFinding {
  type: 'missing_part' | 'missing_object' | 'added_object' | 'changed_object' | 'uncertain' | string;
  title: string;
  detail: string;
  confidence: number;
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
  modified: ModifiedObject[];
  aiFindings: AiFinding[];
}

export interface IDetectionService {
  detect(imageDataUrl: string): Promise<DetectionResult>;
  compare(reference: DetectionResult, current: DetectionResult): DetectionDiff;
  compareDetailed?(
    reference: DetectionResult,
    current: DetectionResult,
  ): Promise<DetectionDiff>;
}
