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

export async function warmUpApi(baseUrl: string): Promise<void> {
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
        if (data?.status === 'ok') return;
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
