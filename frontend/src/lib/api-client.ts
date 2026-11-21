import { auth } from './auth';
import { toApiError } from './api-error';
import { API_BASE_URL } from './config';

// Parallel 401s share one refresh call.
let refreshing: Promise<string | null> | null = null;

function refreshOnce(): Promise<string | null> {
  refreshing ??= auth.refreshToken().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function endSession(): never {
  auth.clearTokens();
  window.location.href = '/login?session=expired';
  throw new Error('Session expired. Please log in again.');
}

/**
 * fetch() against the backend with the user's access token. A 401 on a
 * request that carried a token means it expired (they last an hour): both
 * tokens are renewed and the request retried once. A 401 without a token is
 * a real answer (e.g. a wrong password at login) and goes to the caller. If
 * the refresh fails because of the network, that error propagates and the
 * tokens stay, so a flaky connection never signs anyone out.
 *
 * Returns the raw Response, so streaming callers (the chat) can read the
 * body themselves; REST calls go through customFetch.
 */
export async function authorizedFetch(
  path: string,
  options: RequestInit,
): Promise<Response> {
  const makeRequest = (token: string | null): Promise<Response> =>
    fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

  const token = auth.getAccessToken();
  const response = await makeRequest(token);
  if (
    response.status !== 401 ||
    !token ||
    path.includes('/auth/refresh-token')
  ) {
    return response;
  }
  const newToken = await refreshOnce();
  if (!newToken) endSession();
  return makeRequest(newToken);
}

// The mutator every Orval-generated call goes through. Throws ApiError on a
// non-2xx response; returns Orval's { data, status, headers } shape.
export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const response = await authorizedFetch(url, options);
  if (!response.ok) throw await toApiError(response);

  // 204 No Content — no body to parse.
  const data = response.status === 204 ? undefined : await response.json();
  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
};
