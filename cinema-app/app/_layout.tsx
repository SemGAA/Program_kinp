import { DarkTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { LoadingScreen } from '@/components/loading-screen';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useRuntimeConfig } from '@/hooks/use-runtime-config';
import { AuthProvider } from '@/providers/auth-provider';
import { RuntimeConfigProvider } from '@/providers/runtime-config-provider';

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

function RootNavigator() {
  const { isLoading, isSignedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const inAuthFlow = segments[0] === 'auth';

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

function ConfiguredApp() {
  const { isLoading } = useRuntimeConfig();

  if (isLoading) {
    return <LoadingScreen label="Подключаем конфигурацию сервера..." />;
  }

  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <RuntimeConfigProvider>
        <ConfiguredApp />
      </RuntimeConfigProvider>
    </ThemeProvider>
  );
}
