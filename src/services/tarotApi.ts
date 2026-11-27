import { API_BASE_URL } from '../config/apiConfig';

export const LUNA_FRIENDLY_ERROR =
  'Las cartas necesitan un momento de silencio. Prueba de nuevo en unos segundos.';

export const LUNA_RATE_LIMIT_ERROR =
  'Por hoy ya recibiste tus cartas gratis. Vuelve mañana, o desbloquea la Tirada Completa de 3 Cartas para profundizar.';

const REQUEST_TIMEOUT_MS = 30000;

export class TarotApiError extends Error {
  public readonly isRateLimit: boolean;
  public readonly isAuthRequired: boolean;
  public readonly status?: number;
  public readonly code?: string;

  constructor(
    message: string,
    options: {
      isRateLimit?: boolean;
      isAuthRequired?: boolean;
      status?: number;
      code?: string;
    } = {}
  ) {
    super(message);
    this.name = 'TarotApiError';
    this.isRateLimit = Boolean(options.isRateLimit);
    this.isAuthRequired = Boolean(options.isAuthRequired);
    this.status = options.status;
    this.code = options.code;
  }
}

function buildApiUrl(endpoint: string): string {
  const base = API_BASE_URL.trim().replace(/\/+$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}

export async function getTarotApi<T>(endpoint: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new TarotApiError(LUNA_FRIENDLY_ERROR, { status: response.status });
    }

    const data = await response.json();
    if (!response.ok) {
      throw new TarotApiError(
        typeof data?.error === 'string' && data.error.trim() ? data.error : LUNA_FRIENDLY_ERROR,
        { status: response.status, code: data?.code }
      );
    }

    return data as T;
  } catch (err: unknown) {
    if (err instanceof TarotApiError) throw err;
    throw new TarotApiError(LUNA_FRIENDLY_ERROR);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function postTarotApi<T>(
  endpoint: string,
  body: unknown,
  options: { timeoutMs?: number } = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildApiUrl(endpoint), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      throw new TarotApiError(LUNA_FRIENDLY_ERROR, { status: response.status });
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      throw new TarotApiError(LUNA_FRIENDLY_ERROR, { status: response.status });
    }

    const code = typeof data?.code === 'string' ? data.code : undefined;
    const serverMessage =
      typeof data?.error === 'string' && data.error.trim().length > 0 ? data.error : null;

    if (
      response.status === 429 ||
      code === 'RATE_LIMIT_EXCEEDED' ||
      code === 'DAILY_LIMIT_EXCEEDED' ||
      code === 'CHAT_LIMIT_EXCEEDED' ||
      code === 'ACTIVATION_RATE_LIMIT'
    ) {
      throw new TarotApiError(serverMessage || LUNA_RATE_LIMIT_ERROR, {
        isRateLimit: true,
        status: 429,
        code,
      });
    }

    if (response.status === 401 || code === 'AUTH_REQUIRED' || code === 'PURCHASE_NOT_FOUND') {
      throw new TarotApiError(serverMessage || LUNA_FRIENDLY_ERROR, {
        isAuthRequired: code === 'AUTH_REQUIRED',
        status: 401,
        code,
      });
    }

    if (response.status === 400 || response.status === 503) {
      throw new TarotApiError(serverMessage || LUNA_FRIENDLY_ERROR, {
        status: response.status,
        code,
      });
    }

    if (!response.ok || !data || data.success !== true) {
      throw new TarotApiError(LUNA_FRIENDLY_ERROR, { status: response.status, code });
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
