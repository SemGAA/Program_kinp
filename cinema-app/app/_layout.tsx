import { DarkTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import * as ExpoLinking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { LoadingScreen } from '@/components/loading-screen';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { AuthProvider } from '@/providers/auth-provider';

export const unstable_settings = {
  anchor: '(tabs)',
};

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: AppColors.background,
    border: AppColors.border,
    card: AppColors.background,
    notification: AppColors.accent,
    primary: AppColors.accent,
    text: AppColors.textPrimary,
  },
};

function extractWatchRoomCodeFromUrl(urlValue: string | null) {
  if (!urlValue) {
    return null;
  }

  try {
    const url = new URL(urlValue);

    if (url.protocol === 'cinemaapp:' && url.hostname === 'watch') {
      return url.pathname.replace(/^\/+/, '').trim().toUpperCase() || null;
    }

    const webMatch = `${url.hostname}${url.pathname}`.match(/\/watch\/([^/?#]+)/i);
    return webMatch?.[1]?.trim().toUpperCase() || null;
  } catch {
    return null;
  }
}

function RootNavigator() {
  const { isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const inAuthFlow = segments[0] === 'auth';
  const [pendingWatchCode, setPendingWatchCode] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void ExpoLinking.getInitialURL().then((urlValue) => {
      if (!isMounted) {
        return;
      }

      const roomCode = extractWatchRoomCodeFromUrl(urlValue);
      if (roomCode) {
        setPendingWatchCode(roomCode);
      }
    });

    const subscription = ExpoLinking.addEventListener('url', ({ url }) => {
      const roomCode = extractWatchRoomCodeFromUrl(url);
      if (roomCode) {
        setPendingWatchCode(roomCode);
      }
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isSignedIn && !inAuthFlow) {
      router.replace('/auth');
      return;
    }

    if (isSignedIn && inAuthFlow) {
      router.replace('/');
    }
  }, [inAuthFlow, isLoading, isSignedIn, router]);

  useEffect(() => {
    if (!isSignedIn || !pendingWatchCode) {
      return;
    }

    router.replace({
      pathname: '/watch/[code]',
      params: {
        code: pendingWatchCode,
      },
    });
    setPendingWatchCode(null);
  }, [isSignedIn, pendingWatchCode, router]);

  if (isLoading) {
    return <LoadingScreen label="Проверяем сессию..." />;
  }

  if ((!isSignedIn && !inAuthFlow) || (isSignedIn && inAuthFlow)) {
    return <LoadingScreen label="Открываем приложение..." />;
  }

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: AppColors.background },
          headerShown: false,
        }}>
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
