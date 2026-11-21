import { auth } from './auth';
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

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const makeRequest = (token: string | null): Promise<Response> =>
    fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

  const token = auth.getAccessToken();
  let response = await makeRequest(token);

  // A 401 on a request that carried an access token means it expired (they
  // last an hour): renew both tokens and retry once. A 401 without a token is
  // a real answer (e.g. a wrong password at login) and goes to the caller.
  // If the refresh fails because of the network, that error propagates and
  // the tokens stay, so a flaky connection never signs anyone out.
  if (
    response.status === 401 &&
    token &&
    !url.includes('/auth/refresh-token')
  ) {
    const newToken = await refreshOnce();
    if (!newToken) endSession();
    response = await makeRequest(newToken);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    let errorMessage = `API Error: ${response.statusText}`;

    if (errorData) {
      if (errorData.message) {
        errorMessage = Array.isArray(errorData.message)
          ? errorData.message.join(', ')
          : String(errorData.message);
      } else if (errorData.error) {
        if (
          typeof errorData.error === 'object' &&
          errorData.error.details?.message
        ) {
          const details = errorData.error.details.message;
          errorMessage = Array.isArray(details)
            ? details.join(', ')
            : String(details);
        } else if (
          typeof errorData.error === 'object' &&
          errorData.error.message
        ) {
          errorMessage = String(errorData.error.message);
        } else {
          errorMessage = String(errorData.error);
        }
      } else if (errorData.detail) {
        errorMessage = String(errorData.detail);
      }
    }
    throw new Error(errorMessage);
  }

  // 204 No Content — no body to parse.
  const data = response.status === 204 ? undefined : await response.json();

  // Orval's fetch client expects { data, status, headers }.
  return {
    data,
    status: response.status,
    headers: response.headers,
  } as T;
};
