import { API_BASE_URL } from '../config/apiConfig';

export const LUNA_FRIENDLY_ERROR =
  'Las cartas necesitan un momento de silencio. Probá de nuevo en unos segundos.';

export const LUNA_RATE_LIMIT_ERROR =
  'Hoy ya consultaste tus 5 cartas gratuitas. Las cartas necesitan reposar hasta mañana para seguir guiándote con claridad.';

const REQUEST_TIMEOUT_MS = 30000;

export class TarotApiError extends Error {
  public readonly isRateLimit: boolean;

  constructor(message: string, isRateLimit = false) {
    super(message);
    this.name = 'TarotApiError';
    this.isRateLimit = isRateLimit;
  }
}

function buildApiUrl(endpoint: string): string {
  const base = API_BASE_URL.trim().replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

export async function postTarotApi<T>(endpoint: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    // Verificar que la respuesta sea JSON antes de intentar leerla
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new TarotApiError(LUNA_FRIENDLY_ERROR);
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new TarotApiError(LUNA_FRIENDLY_ERROR);
    }

    if (response.status === 429 || data?.code === 'RATE_LIMIT_EXCEEDED') {
      const limitMessage =
        typeof data?.error === 'string' && data.error.trim().length > 0
          ? data.error
          : LUNA_RATE_LIMIT_ERROR;
      throw new TarotApiError(limitMessage, true);
    }

    if (!response.ok || !data || data.success !== true || !data.data) {
      throw new TarotApiError(LUNA_FRIENDLY_ERROR);
    }

    return data as T;
  } catch (err: unknown) {
    if (err instanceof TarotApiError) {
      throw err;
    }
    throw new TarotApiError(LUNA_FRIENDLY_ERROR);
  } finally {
    clearTimeout(timeoutId);
  }
}
