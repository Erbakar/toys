import { useEffect, useState } from 'react';
import { configuredApiUrl, shouldUseMockDetection } from '../config/detectionConfig';
import { warmUpApi } from '../utils/apiClient';

export type ApiWarmupStatus = 'idle' | 'warming' | 'ready' | 'failed';

export function useApiWarmup() {
  const [status, setStatus] = useState<ApiWarmupStatus>(
    shouldUseMockDetection ? 'ready' : 'warming',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shouldUseMockDetection) return;

    let cancelled = false;

    warmUpApi(configuredApiUrl)
      .then(() => {
        if (!cancelled) {
          setStatus('ready');
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('failed');
          setError(err instanceof Error ? err.message : 'Backend hazır değil.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    if (shouldUseMockDetection) return;

    setStatus('warming');
    setError(null);

    warmUpApi(configuredApiUrl)
      .then(() => {
        setStatus('ready');
        setError(null);
      })
      .catch((err) => {
        setStatus('failed');
        setError(err instanceof Error ? err.message : 'Backend hazır değil.');
      });
  };

  return { status, error, retry };
}
