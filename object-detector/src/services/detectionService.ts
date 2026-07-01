import { MockDetectionService } from './MockDetectionService';
import { ApiDetectionService } from './ApiDetectionService';

export const detectionService =
  import.meta.env.VITE_USE_MOCK === 'true'
    ? new MockDetectionService()
    : new ApiDetectionService(import.meta.env.VITE_API_URL);
