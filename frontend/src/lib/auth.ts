import { API_BASE_URL } from './config';

const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';

export const auth = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Trades the refresh token for a new pair and stores it.
   * Resolves to the new access token, or null when there's no refresh token
   * or the server rejects it (401: expired, invalid, account disabled).
   * Throws on anything transient (offline, 5xx during a deploy), so callers
   * keep the tokens and can try again rather than signing the user out.
   */
  async refreshToken(): Promise<string | null> {
    const refreshToken = auth.getRefreshToken();
    if (!refreshToken) return null;

    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

    const body = (await res.json()) as {
      data: { accessToken: string; refreshToken: string };
    };
    auth.setTokens(body.data.accessToken, body.data.refreshToken);
    return body.data.accessToken;
  },
};
