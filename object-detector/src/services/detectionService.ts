import { MockDetectionService } from './MockDetectionService';
import { ApiDetectionService } from './ApiDetectionService';
import { configuredApiUrl, shouldUseMockDetection } from '../config/detectionConfig';
import type { IDetectionService } from '../types/detection';

const mockDetectionService = new MockDetectionService();
const apiDetectionService = new ApiDetectionService(configuredApiUrl);

// Mock sadece VITE_USE_MOCK !== 'false' iken. Gerçek modda API hatası kullanıcıya gösterilir.
export const detectionService: IDetectionService =
  shouldUseMockDetection ? mockDetectionService : apiDetectionService;
