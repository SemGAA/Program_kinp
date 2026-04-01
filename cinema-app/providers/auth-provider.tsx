import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '@/lib/api';
import { clearStoredToken, getStoredToken, setStoredToken } from '@/lib/session-storage';
import type { AuthUser } from '@/types/app';

type AuthContextValue = {
  isLoading: boolean;
  isSignedIn: boolean;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (payload: { email: string; name: string; password: string }) => Promise<void>;
  token: string | null;
  user: AuthUser | null;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const storedToken = await getStoredToken();

      if (!storedToken) {
        setToken(null);
        setUser(null);
        return;
      }

      const currentUser = await getCurrentUser(storedToken);
      setToken(storedToken);
      setUser(currentUser);
    } catch {
      setToken(null);
      setUser(null);
      await clearStoredToken();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const persistSession = useCallback(async (nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    await setStoredToken(nextToken);
  }, []);

  const signIn = useCallback(
    async (payload: { email: string; password: string }) => {
      const session = await loginUser(payload);
      await persistSession(session.access_token, session.user);
    },
    [persistSession],
  );

  const signUp = useCallback(
    async (payload: { email: string; name: string; password: string }) => {
      const session = await registerUser(payload);
      await persistSession(session.access_token, session.user);
    },
    [persistSession],
  );

  const signOut = useCallback(async () => {
    const currentToken = token;

    setToken(null);
    setUser(null);
    await clearStoredToken();

    if (currentToken) {
      try {
        await logoutUser(currentToken);
      } catch {
        // Ignore logout network errors once the local session is removed.
      }
    }
  }, [token]);

  const refreshUser = useCallback(async () => {
    if (!token) {
      return;
    }

    const currentUser = await getCurrentUser(token);
    setUser(currentUser);
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isSignedIn: !!token && !!user,
      signIn,
      signOut,
      signUp,
      token,
      user,
      refreshUser,
    }),
    [isLoading, signIn, signOut, signUp, token, user, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }

  return context;
}

