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
  resendRegistrationCode as resendRegistrationCodeRequest,
  verifyRegistrationCode as verifyRegistrationCodeRequest,
} from '@/lib/api';
import { clearStoredToken, getStoredToken, setStoredToken } from '@/lib/session-storage';
import type { AuthUser, RegistrationChallenge } from '@/types/app';

type AuthContextValue = {
  clearPendingVerification: () => void;
  isLoading: boolean;
  isSignedIn: boolean;
  pendingVerification: RegistrationChallenge | null;
  resendVerificationCode: (email: string) => Promise<RegistrationChallenge>;
  signIn: (payload: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (payload: { email: string; name: string; password: string }) => Promise<RegistrationChallenge>;
  token: string | null;
  user: AuthUser | null;
  refreshUser: () => Promise<void>;
  verifyRegistrationCode: (payload: { code: string; email: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [pendingVerification, setPendingVerification] = useState<RegistrationChallenge | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const storedToken = await getStoredToken();

      if (!storedToken) {
        setPendingVerification(null);
        setToken(null);
        setUser(null);
        return;
      }

      const currentUser = await getCurrentUser(storedToken);
      setPendingVerification(null);
      setToken(storedToken);
      setUser(currentUser);
    } catch {
      setPendingVerification(null);
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
    setPendingVerification(null);
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
      const challenge = await registerUser(payload);
      setPendingVerification(challenge);
      return challenge;
    },
    [],
  );

  const verifyRegistration = useCallback(
    async (payload: { code: string; email: string }) => {
      const session = await verifyRegistrationCodeRequest(payload);
      await persistSession(session.access_token, session.user);
    },
    [persistSession],
  );

  const resendVerificationCode = useCallback(async (email: string) => {
    const challenge = await resendRegistrationCodeRequest(email);
    setPendingVerification(challenge);
    return challenge;
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = token;

    setPendingVerification(null);
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
      clearPendingVerification: () => setPendingVerification(null),
      isLoading,
      isSignedIn: !!token && !!user,
      pendingVerification,
      resendVerificationCode,
      signIn,
      signOut,
      signUp,
      token,
      user,
      refreshUser,
      verifyRegistrationCode: verifyRegistration,
    }),
    [
      isLoading,
      pendingVerification,
      resendVerificationCode,
      signIn,
      signOut,
      signUp,
      token,
      user,
      refreshUser,
      verifyRegistration,
    ],
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
