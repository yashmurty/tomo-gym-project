import { auth } from './auth';
import { API_BASE_URL } from './config';

// Token-refresh stampede guard: parallel 401s share one refresh call.
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const makeRequest = async (
    tokenOverride?: string | null,
  ): Promise<Response> => {
    const token =
      tokenOverride !== undefined ? tokenOverride : auth.getAccessToken();

    return fetch(`${API_BASE_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
  };

  let response = await makeRequest();

  // Handle 401 Unauthorized — try to refresh the access token once, then retry
  // the original request. Guard against recursing on the refresh endpoint itself.
  if (response.status === 401 && !url.includes('/auth/refresh-token')) {
    if (isRefreshing && refreshPromise) {
      // Another request is already refreshing — wait for it, then retry.
      const newToken = await refreshPromise;
      if (newToken) {
        response = await makeRequest(newToken);
      } else {
        auth.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login?session=expired';
        }
        throw new Error('Session expired. Please login again.');
      }
    } else {
      isRefreshing = true;
      refreshPromise = auth.refreshToken();
      try {
        const newToken = await refreshPromise;
        if (newToken) {
          response = await makeRequest(newToken);
        } else {
          auth.clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/login?session=expired';
          }
          throw new Error('Session expired. Please login again.');
        }
      } catch {
        auth.clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login?session=expired';
        }
        throw new Error('Session expired. Please login again.');
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }
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
