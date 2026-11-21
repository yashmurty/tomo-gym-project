// A failed API call, carrying what screens need to explain it in the user's
// language: the HTTP status, the backend's machine-readable code (on 429s:
// rate_limited, daily_budget, monthly_budget, service_paused) and
// Retry-After. `message` is the backend's English text, for logs only:
// never show it to users (constitution rule 23).
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterSec?: number;

  constructor(
    message: string,
    status: number,
    code?: string,
    retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

type ErrorBody = {
  message?: unknown;
  detail?: unknown;
  error?:
    | string
    | {
        message?: unknown;
        details?: { message?: unknown; code?: unknown } | string;
      };
};

const joined = (value: unknown) =>
  Array.isArray(value) ? value.join(', ') : String(value);

// The backend's error body ({ error: { message, details: { code, … } } })
// turned into an ApiError.
export async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  let message = `API Error: ${response.status} ${response.statusText}`;
  let code: string | undefined;

  if (body?.message) {
    message = joined(body.message);
  } else if (typeof body?.error === 'object' && body.error) {
    const details = body.error.details;
    if (typeof details === 'object' && details) {
      if (details.message) message = joined(details.message);
      else if (body.error.message) message = joined(body.error.message);
      if (typeof details.code === 'string') code = details.code;
    } else if (body.error.message) {
      message = joined(body.error.message);
    }
  } else if (typeof body?.error === 'string') {
    message = body.error;
  } else if (body?.detail) {
    message = joined(body.detail);
  }

  const retryAfter = Number(response.headers.get('Retry-After'));
  return new ApiError(
    message,
    response.status,
    code,
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
  );
}
