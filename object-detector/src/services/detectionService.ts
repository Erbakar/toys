import { MockDetectionService } from './MockDetectionService';
import { ApiDetectionService } from './ApiDetectionService';
import { FallbackDetectionService } from './FallbackDetectionService';
import { configuredApiUrl, shouldUseMockDetection } from '../config/detectionConfig';

// Varsayılan: mock. Sadece VITE_USE_MOCK='false' olduğunda API kullanılır.
// Vercel'de env var tanımlanmamışsa MockDetectionService devreye girer.
const mockDetectionService = new MockDetectionService();
const apiDetectionService = new ApiDetectionService(configuredApiUrl);

export const detectionService =
  shouldUseMockDetection
    ? mockDetectionService
    : new FallbackDetectionService(apiDetectionService, mockDetectionService);
