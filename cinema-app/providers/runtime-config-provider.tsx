import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DEFAULT_API_BASE_URL } from '@/lib/config';
import { bootstrapApiBaseUrl, persistApiBaseUrl, resetApiBaseUrl } from '@/lib/runtime-config';

type RuntimeConfigContextValue = {
  apiBaseUrl: string;
  defaultApiBaseUrl: string;
  isLoading: boolean;
  resetApiUrl: () => Promise<void>;
  setApiUrl: (value: string) => Promise<void>;
};

const RuntimeConfigContext = createContext<RuntimeConfigContextValue | null>(null);

export function RuntimeConfigProvider({ children }: PropsWithChildren) {
  const [apiBaseUrl, setApiBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const nextValue = await bootstrapApiBaseUrl();
        setApiBaseUrl(nextValue);
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const handleSetApiUrl = useCallback(async (value: string) => {
    const nextValue = await persistApiBaseUrl(value);
    setApiBaseUrl(nextValue);
  }, []);

  const handleResetApiUrl = useCallback(async () => {
    const nextValue = await resetApiBaseUrl();
    setApiBaseUrl(nextValue);
  }, []);

  const value = useMemo<RuntimeConfigContextValue>(
    () => ({
      apiBaseUrl,
      defaultApiBaseUrl: DEFAULT_API_BASE_URL,
      isLoading,
      resetApiUrl: handleResetApiUrl,
      setApiUrl: handleSetApiUrl,
    }),
    [apiBaseUrl, handleResetApiUrl, handleSetApiUrl, isLoading],
  );

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfigContext() {
  const context = useContext(RuntimeConfigContext);

  if (!context) {
    throw new Error('useRuntimeConfigContext must be used within RuntimeConfigProvider');
  }

  return context;
}
