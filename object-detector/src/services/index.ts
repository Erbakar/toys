import type { IDetectionService } from '../types/detection';
import { MockDetectionService } from './MockDetectionService';
import { ApiDetectionService } from './ApiDetectionService';

/**
 * Hangi servisin kullanılacağını .env üzerinden seçin:
 *
 *   VITE_DETECTION_SERVICE=mock   → MockDetectionService  (varsayılan)
 *   VITE_DETECTION_SERVICE=api    → ApiDetectionService
 *
 * ApiDetectionService için backend URL'yi de tanımlayın:
 *   VITE_API_BASE_URL=http://localhost:8000
 */
function createDetectionService(): IDetectionService {
  const mode = import.meta.env.VITE_DETECTION_SERVICE ?? 'mock';

  if (mode === 'api') {
    return new ApiDetectionService();
  }

  return new MockDetectionService();
}

export const detectionService: IDetectionService = createDetectionService();
