import { useEffect } from 'react';
import { configuredApiUrl, shouldUseMockDetection } from '../config/detectionConfig';
import { startApiKeepAlive } from '../utils/apiClient';

/** Kontrol fotoğrafı aşamasında Render servisinin uyumasını engeller. */
export function useApiKeepAlive(enabled = true): void {
  useEffect(() => {
    if (shouldUseMockDetection || !enabled) return;

    return startApiKeepAlive(configuredApiUrl);
  }, [enabled]);
}
