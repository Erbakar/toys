import { MockDetectionService } from './MockDetectionService';
import { ApiDetectionService } from './ApiDetectionService';

// Varsayılan: mock. Sadece VITE_USE_MOCK='false' olduğunda API kullanılır.
// Vercel'de env var tanımlanmamışsa MockDetectionService devreye girer.
export const detectionService =
  import.meta.env.VITE_USE_MOCK !== 'false'
    ? new MockDetectionService()
    : new ApiDetectionService(import.meta.env.VITE_API_URL);
