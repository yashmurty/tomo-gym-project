import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { auth } from './auth';
import {
  authControllerLogin,
  authControllerRegisterLocal,
} from './generated/auth/auth';
import type {
  LoginInput,
  RegisterInput,
  SwaggerBaseApiResponseForAuthTokenOutput,
  SwaggerBaseApiResponseForUserOutput,
  UpdateUserInput,
  UserOutput,
} from './generated/models';
import {
  userControllerGetMyProfile,
  userControllerUpdateUser,
} from './generated/users/users';
import { decodeJwt, isExpired, type JwtPayload } from './jwt';

export type User = {
  id: number;
  email: string;
  roles: string[];
};

type AuthContextValue = {
  user: User | null;
  /** The signed-in user's own record (`GET /users/me`); null until loaded. */
  profile: UserOutput | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  /** PATCHes the signed-in user and replaces `profile` with the result. */
  updateProfile: (input: UpdateUserInput) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function userFromToken(token: string): User | null {
  const payload = decodeJwt<JwtPayload>(token);
  if (!payload) return null;
  return {
    id: payload.sub,
    email: payload.email,
    roles: payload.roles,
  };
}

// Who's signed in at page load. The access token lasts an hour and the
// refresh token 90 days, so an expired access token is normal: while the
// refresh token is valid the user stays signed in, and the first API call
// (GET /users/me, right after mount) gets a 401 that customFetch answers by
// renewing both tokens. Otherwise the tokens are dead: clear them.
function restoreUser(): User | null {
  const access = auth.getAccessToken();
  const claims = access ? decodeJwt<JwtPayload>(access) : null;
  if (access && claims) {
    const refresh = auth.getRefreshToken();
    const refreshClaims = refresh ? decodeJwt<{ exp: number }>(refresh) : null;
    if (!isExpired(claims) || (refreshClaims && !isExpired(refreshClaims))) {
      return userFromToken(access);
    }
  }
  auth.clearTokens();
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(restoreUser);
  const [profile, setProfile] = useState<UserOutput | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!auth.getAccessToken()) {
      setProfile(null);
      return;
    }
    try {
      const res = await userControllerGetMyProfile();
      const body = res.data as SwaggerBaseApiResponseForUserOutput;
      setProfile(body.data);
    } catch {
      // Ignore — the customFetch mutator already redirects to /login on auth
      // failure; transient errors leave profile null and the UI will retry on
      // the next mount.
      setProfile(null);
    }
  }, []);

  // Fetch profile once per logged-in session. logout() clears it directly;
  // explicit refreshes call refreshProfile().
  const fetchedForUserId = useRef<number | null>(null);
  useEffect(() => {
    if (user && fetchedForUserId.current !== user.id) {
      fetchedForUserId.current = user.id;
      void refreshProfile();
    }
    if (!user) {
      fetchedForUserId.current = null;
    }
  }, [user, refreshProfile]);

  const login = useCallback(async (input: LoginInput) => {
    const res = await authControllerLogin(input);
    // The mutator throws on non-2xx, so res.data is the success shape at runtime.
    const body = res.data as SwaggerBaseApiResponseForAuthTokenOutput;
    auth.setTokens(body.data.accessToken, body.data.refreshToken);
    setUser(userFromToken(body.data.accessToken));
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      await authControllerRegisterLocal(input);
      // Backend register doesn't return tokens — auto-login afterwards.
      await login({ email: input.email, password: input.password });
    },
    [login],
  );

  const logout = useCallback(() => {
    auth.clearTokens();
    setUser(null);
    setProfile(null);
  }, []);

  const updateProfile = useCallback(
    async (input: UpdateUserInput) => {
      if (!user) throw new Error('Not signed in');
      const res = await userControllerUpdateUser(user.id, input);
      setProfile((res.data as SwaggerBaseApiResponseForUserOutput).data);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        login,
        register,
        logout,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
