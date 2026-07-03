const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function resolveApiBaseUrl(baseUrl: string): string {
  const fallback = 'http://localhost:8000';

  try {
    const url = new URL(baseUrl || fallback);
    const pageHost = window.location.hostname;
    const apiHostIsLocal = LOCAL_HOSTS.has(url.hostname);
    const pageHostIsLocal = LOCAL_HOSTS.has(pageHost);

    if (apiHostIsLocal && pageHost && !pageHostIsLocal) {
      url.hostname = pageHost;
    }

    return url.toString().replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const WARMUP_ATTEMPTS = 18;
const WARMUP_DELAY_MS = 5000;
const HEALTH_TIMEOUT_MS = 30_000;
const WARM_CACHE_MS = 120_000;

let lastWarmSuccessAt = 0;

export function invalidateWarmCache(): void {
  lastWarmSuccessAt = 0;
}

export async function pingApi(baseUrl: string): Promise<boolean> {
  const resolved = resolveApiBaseUrl(baseUrl);

  try {
    const res = await fetchWithTimeout(
      `${resolved}/health`,
      { method: 'GET' },
      HEALTH_TIMEOUT_MS,
    );

    if (!res.ok) return false;

    const data = (await res.json().catch(() => null)) as { status?: string } | null;
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

export function startApiKeepAlive(baseUrl: string, intervalMs = 25_000): () => void {
  const timer = window.setInterval(() => {
    void pingApi(baseUrl).then((ok) => {
      if (ok) {
        lastWarmSuccessAt = Date.now();
      } else {
        invalidateWarmCache();
      }
    });
  }, intervalMs);

  return () => window.clearInterval(timer);
}

interface WarmUpOptions {
  force?: boolean;
}

export async function warmUpApi(baseUrl: string, options: WarmUpOptions = {}): Promise<void> {
  if (!options.force && Date.now() - lastWarmSuccessAt < WARM_CACHE_MS) {
    return;
  }

  const resolved = resolveApiBaseUrl(baseUrl);

  for (let attempt = 0; attempt < WARMUP_ATTEMPTS; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${resolved}/health`,
        { method: 'GET' },
        HEALTH_TIMEOUT_MS,
      );

      if (res.ok) {
        const data = (await res.json().catch(() => null)) as { status?: string } | null;
        if (data?.status === 'ok') {
          lastWarmSuccessAt = Date.now();
          return;
        }
      }
    } catch {
      // Render cold start — tekrar dene
    }

    if (attempt < WARMUP_ATTEMPTS - 1) {
      await sleep(WARMUP_DELAY_MS);
    }
  }

  throw new Error(
    `Backend hazır olmadı (${resolved}). Render servisi uyuyor — 1–2 dk bekleyip sayfayı yenileyin.`,
  );
}
