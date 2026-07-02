const DEFAULT_API_URL = 'http://localhost:8000';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export const configuredApiUrl = import.meta.env.VITE_API_URL || DEFAULT_API_URL;

export function isLocalApiUrl(apiUrl: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(apiUrl).hostname);
  } catch {
    return true;
  }
}

export const hasPublicApiUrl = !isLocalApiUrl(configuredApiUrl);

export const shouldUseMockDetection =
  import.meta.env.VITE_USE_MOCK !== 'false' ||
  (import.meta.env.PROD && !hasPublicApiUrl);

export const isForcedMockInProduction =
  import.meta.env.PROD &&
  import.meta.env.VITE_USE_MOCK === 'false' &&
  !hasPublicApiUrl;
