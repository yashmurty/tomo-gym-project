import { customFetch } from './api-client';

const API = '/api/v1/users/me';
const REFRESH = '/api/v1/auth/refresh-token';

function json(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<typeof fetch>();
const location = { href: 'http://localhost/' };

function authHeader(call: Parameters<typeof fetch>): string | undefined {
  const headers = (call[1]?.headers ?? {}) as Record<string, string>;
  return headers.Authorization;
}

const calls = (url: string) =>
  fetchMock.mock.calls.filter(([u]) => String(u) === url);

describe('customFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    location.href = 'http://localhost/';
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', location);
  });
  afterEach(() => vi.unstubAllGlobals());

  function signedIn() {
    localStorage.setItem('accessToken', 'old-access');
    localStorage.setItem('refreshToken', 'old-refresh');
  }

  test('sends the access token and returns { data, status, headers }', async () => {
    signedIn();
    fetchMock.mockResolvedValue(json(200, { data: { id: 1 } }));

    const res = await customFetch<{ data: unknown; status: number }>(API, {});

    expect(authHeader(fetchMock.mock.calls[0])).toBe('Bearer old-access');
    expect(res).toMatchObject({ data: { data: { id: 1 } }, status: 200 });
  });

  test('renews an expired access token once and retries', async () => {
    signedIn();
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === REFRESH) {
        return json(200, {
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new-access'
        ? json(200, { data: 'ok' })
        : json(401);
    });

    const res = await customFetch<{ status: number }>(API, {});

    expect(res.status).toBe(200);
    expect(calls(REFRESH)).toHaveLength(1);
    expect(localStorage.getItem('accessToken')).toBe('new-access');
    expect(localStorage.getItem('refreshToken')).toBe('new-refresh');
  });

  test('parallel 401s share one refresh call', async () => {
    signedIn();
    fetchMock.mockImplementation(async (url, init) => {
      if (String(url) === REFRESH) {
        await new Promise((r) => setTimeout(r, 10));
        return json(200, {
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === 'Bearer new-access' ? json(200) : json(401);
    });

    await Promise.all([customFetch(API, {}), customFetch(API, {})]);

    expect(calls(REFRESH)).toHaveLength(1);
  });

  test('a rejected refresh token ends the session', async () => {
    signedIn();
    fetchMock.mockResolvedValue(json(401));

    await expect(customFetch(API, {})).rejects.toThrow('Session expired');

    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('refreshToken')).toBeNull();
    expect(location.href).toBe('/login?session=expired');
  });

  test.each([
    ['offline', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['a 502 during a deploy', async () => json(502)],
  ])(
    'a refresh that fails because of %s keeps the tokens',
    async (_, refresh) => {
      signedIn();
      fetchMock.mockImplementation(async (url) =>
        String(url) === REFRESH ? refresh() : json(401),
      );

      await expect(customFetch(API, {})).rejects.toThrow();

      expect(localStorage.getItem('accessToken')).toBe('old-access');
      expect(localStorage.getItem('refreshToken')).toBe('old-refresh');
      expect(location.href).toBe('http://localhost/');
    },
  );

  test('a 401 without a token (wrong password) goes to the caller, no refresh', async () => {
    fetchMock.mockResolvedValue(
      json(401, { error: { message: 'Invalid credentials' } }),
    );

    await expect(customFetch('/api/v1/auth/login', {})).rejects.toThrow(
      'Invalid credentials',
    );

    expect(calls(REFRESH)).toHaveLength(0);
    expect(location.href).toBe('http://localhost/');
  });
});
