import { useState, useCallback } from 'react';
import type { DetectionResult } from '../types/detection';
import { detectionService } from '../services/detectionService';

export interface UseDetectionReturn {
  isDetecting: boolean;
  error: string | null;
  detect: (imageDataUrl: string) => Promise<DetectionResult | null>;
}

export function useDetection(): UseDetectionReturn {
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detect = useCallback(async (imageDataUrl: string): Promise<DetectionResult | null> => {
    setIsDetecting(true);
    setError(null);

    try {
      const result = await detectionService.detect(imageDataUrl);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Nesne algılama başarısız oldu.';
      setError(message);
      return null;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  return { isDetecting, error, detect };
}
