export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface ApiErrorPayload {
  statusCode?: number;
  message?: string | string[];
  error?: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly validationMessages: string[];
  public readonly details: unknown;

  constructor(
    status: number,
    message: string,
    validationMessages: string[] = [],
    details: unknown = null
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.validationMessages = validationMessages;
    this.details = details;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  const baseUrl = (envUrl || 'http://localhost:3000/api/v1').replace(/\/+$/, '');
  const url = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok) {
      const errObj = body as ApiErrorPayload | null;
      let msg = response.statusText || `HTTP Error ${response.status}`;
      let valMsgs: string[] = [];

      if (errObj?.message) {
        if (Array.isArray(errObj.message)) {
          valMsgs = errObj.message;
          msg = valMsgs.join(', ');
        } else {
          msg = errObj.message;
          valMsgs = [msg];
        }
      }

      throw new ApiError(response.status, msg, valMsgs, body);
    }

    return body as T;
  } catch (error: unknown) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    const networkMsg = error instanceof Error ? error.message : 'Network request failed';
    throw new ApiError(0, `Server unreachable: ${networkMsg}`);
  }
}
