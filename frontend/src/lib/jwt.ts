export type JwtPayload = {
  sub: number;
  email: string;
  roles: string[];
  iat: number;
  exp: number;
};

export function decodeJwt<T = JwtPayload>(token: string): T | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as T;
  } catch {
    return null;
  }
}

export function isExpired(payload: { exp: number }): boolean {
  return payload.exp * 1000 < Date.now();
}
