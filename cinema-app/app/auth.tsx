import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useRuntimeConfig } from '@/hooks/use-runtime-config';
import { ApiConnectionError, ApiError } from '@/lib/api';

type Mode = 'login' | 'register';

type DemoAccount = {
  email: string;
  password: string;
};

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const { apiBaseUrl, defaultApiBaseUrl, refreshApiUrl, resetApiUrl, setApiUrl } = useRuntimeConfig();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrlDraft, setApiUrlDraft] = useState(apiBaseUrl);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshingApiUrl, setIsRefreshingApiUrl] = useState(false);
  const [isSavingApiUrl, setIsSavingApiUrl] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setApiUrlDraft(apiBaseUrl);
  }, [apiBaseUrl]);

  useEffect(() => {
    const syncApiUrl = async () => {
      setIsRefreshingApiUrl(true);

      try {
        await refreshApiUrl();
      } finally {
        setIsRefreshingApiUrl(false);
      }
    };

    void syncApiUrl();
  }, [refreshApiUrl]);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim() || (mode === 'register' && !name.trim())) {
      setError('Заполните обязательные поля.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'login') {
        await signIn({ email: email.trim(), password });
      } else {
        await signUp({ email: email.trim(), name: name.trim(), password });
      }
    } catch (caughtError) {
      let message = 'Не удалось выполнить запрос.';

      if (caughtError instanceof ApiConnectionError) {
        message = `Нет подключения к серверу (${apiBaseUrl}). Проверьте адрес API и доступность backend.`;
      } else if (caughtError instanceof ApiError) {
        message = caughtError.message;
      }

      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveApiUrl = async () => {
    if (!apiUrlDraft.trim()) {
      setError('Укажите адрес backend API.');
      return;
    }

    setIsSavingApiUrl(true);
    setError(null);

    try {
      await setApiUrl(apiUrlDraft);
      Alert.alert('Сервер обновлён', 'Новый адрес backend сохранён в приложении.');
    } catch {
      setError('Не удалось сохранить адрес сервера.');
    } finally {
      setIsSavingApiUrl(false);
    }
  };

  const handleResetApiUrl = async () => {
    setIsSavingApiUrl(true);
    setError(null);

    try {
      await resetApiUrl();
      Alert.alert('Сервер сброшен', `Вернули адрес по умолчанию: ${defaultApiBaseUrl}`);
    } catch {
      setError('Не удалось сбросить адрес сервера.');
    } finally {
      setIsSavingApiUrl(false);
    }
  };

  const handleRefreshApiUrl = async () => {
    setIsRefreshingApiUrl(true);
    setError(null);

    try {
      const nextValue = await refreshApiUrl();
      Alert.alert('Сервер обновлён', `Приложение использует адрес: ${nextValue}`);
    } catch {
      setError('Не удалось автоматически обновить адрес сервера.');
    } finally {
      setIsRefreshingApiUrl(false);
    }
  };

  const applyDemoAccount = (account: DemoAccount) => {
    setMode('login');
    setName('');
    setEmail(account.email);
    setPassword(account.password);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Cinema Notes</Text>
          <Text style={styles.title}>Вход и совместный просмотр</Text>
          <Text style={styles.subtitle}>
            Приложение хранит заметки, комнаты совместного просмотра и синхронизацию через backend API.
          </Text>
        </View>

        <View style={styles.serverCard}>
          <Text style={styles.serverTitle}>Подключение к серверу</Text>
          <Text style={styles.serverHint}>
            Активный адрес подхватывается автоматически. Ручной ввод нужен только если хотите
            переопределить сервер вручную.
          </Text>
          <Text style={styles.serverValue}>Сейчас используется: {apiBaseUrl}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={setApiUrlDraft}
            placeholder="https://your-public-backend.example/api"
            placeholderTextColor={AppColors.textSecondary}
            style={styles.input}
            value={apiUrlDraft}
          />
          <View style={styles.serverButtonRow}>
            <Pressable
              onPress={() => void handleRefreshApiUrl()}
              style={[styles.secondaryButton, styles.flexButton]}>
              {isRefreshingApiUrl ? (
                <ActivityIndicator color={AppColors.textPrimary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Обновить автоматически</Text>
              )}
            </Pressable>
          </View>
          <View style={styles.serverButtonRow}>
            <Pressable
              onPress={() => void handleSaveApiUrl()}
              style={[styles.secondaryButton, styles.flexButton]}>
              {isSavingApiUrl ? (
                <ActivityIndicator color={AppColors.textPrimary} />
              ) : (
                <Text style={styles.secondaryButtonText}>Сохранить адрес</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => void handleResetApiUrl()}
              style={[styles.ghostButton, styles.flexButton]}>
              <Text style={styles.ghostButtonText}>Сбросить</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.switchRow}>
          <Pressable
            onPress={() => setMode('login')}
            style={[styles.switchButton, mode === 'login' && styles.switchButtonActive]}>
            <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>Вход</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('register')}
            style={[styles.switchButton, mode === 'register' && styles.switchButtonActive]}>
            <Text style={[styles.switchText, mode === 'register' && styles.switchTextActive]}>
              Регистрация
            </Text>
          </Pressable>
        </View>

        <View style={styles.demoCard}>
          <Text style={styles.demoTitle}>Быстрый вход для теста</Text>
          <Text style={styles.subtitle}>
            После `php artisan migrate:fresh --seed` доступны два тестовых аккаунта.
          </Text>
          <View style={styles.demoRow}>
            <Pressable
              onPress={() =>
                applyDemoAccount({
                  email: 'alice@example.com',
                  password: 'password123',
                })
              }
              style={styles.demoButton}>
              <Text style={styles.demoButtonText}>Alice</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                applyDemoAccount({
                  email: 'bob@example.com',
                  password: 'password123',
                })
              }
              style={styles.demoButton}>
              <Text style={styles.demoButtonText}>Bob</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.card}>
          {mode === 'register' ? (
            <TextInput
              autoCapitalize="words"
              onChangeText={setName}
              placeholder="Имя"
              placeholderTextColor={AppColors.textSecondary}
              style={styles.input}
              value={name}
            />
          ) : null}
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={AppColors.textSecondary}
            style={styles.input}
            value={email}
          />
          <TextInput
            onChangeText={setPassword}
            placeholder="Пароль"
            placeholderTextColor={AppColors.textSecondary}
            secureTextEntry
            style={styles.input}
            value={password}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={() => void handleSubmit()} style={styles.submitButton}>
            {isSubmitting ? (
              <ActivityIndicator color={AppColors.textPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'login' ? 'Войти' : 'Создать аккаунт'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.card,
    borderColor: AppColors.border,
    borderRadius: 28,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  content: {
    flexGrow: 1,
    gap: 18,
    justifyContent: 'center',
    padding: 20,
  },
  demoButton: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  demoButtonText: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  demoCard: {
    backgroundColor: AppColors.card,
    borderColor: AppColors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  demoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  demoTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  eyebrow: {
    color: AppColors.accentSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  flexButton: {
    flex: 1,
  },
  ghostButton: {
    alignItems: 'center',
    borderColor: AppColors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  ghostButtonText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  hero: {
    gap: 10,
  },
  input: {
    backgroundColor: '#0D1627',
    borderColor: AppColors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: AppColors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  screen: {
    backgroundColor: AppColors.background,
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  serverButtonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  serverCard: {
    backgroundColor: AppColors.card,
    borderColor: AppColors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  serverHint: {
    color: AppColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  serverValue: {
    color: AppColors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  serverTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: AppColors.accent,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  submitButtonText: {
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: AppColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  switchButton: {
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderColor: AppColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  switchButtonActive: {
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.accent,
  },
  switchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  switchText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  switchTextActive: {
    color: AppColors.textPrimary,
  },
  title: {
    color: AppColors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
  },
});
