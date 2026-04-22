import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { ApiConnectionError, ApiError } from '@/lib/api';

type Mode = 'login' | 'register' | 'verify';

function readVerificationPayload(error: ApiError | null) {
  if (!error || typeof error.payload !== 'object' || !error.payload) {
    return null;
  }

  const payload = error.payload as {
    email?: string;
    verificationRequired?: boolean;
  };

  return payload.verificationRequired ? payload : null;
}

export default function AuthScreen() {
  const {
    clearPendingVerification,
    pendingVerification,
    resendVerificationCode,
    signIn,
    signUp,
    verifyRegistrationCode,
  } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (pendingVerification) {
      setMode('verify');
      setEmail(pendingVerification.email);
    }
  }, [pendingVerification]);

  const verificationHint = useMemo(() => {
    if (!pendingVerification?.expiresAt) {
      return 'Код подтверждения отправлен на почту. Он нужен только один раз, чтобы завершить регистрацию.';
    }

    const expiresDate = new Date(pendingVerification.expiresAt);
    const expiresAtLabel = Number.isNaN(expiresDate.getTime())
      ? ''
      : `Код действует до ${expiresDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}.`;

    return (
      expiresAtLabel ||
      'Код подтверждения отправлен на почту. Он нужен только один раз, чтобы завершить регистрацию.'
    );
  }, [pendingVerification?.expiresAt]);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();

    if (mode === 'verify') {
      if (!trimmedEmail || !verificationCode.trim()) {
        setError('Введите email и код подтверждения.');
        return;
      }

      setIsSubmitting(true);
      setError(null);

      try {
        await verifyRegistrationCode({
          code: verificationCode.trim(),
          email: trimmedEmail,
        });
      } catch (caughtError) {
        if (caughtError instanceof ApiConnectionError) {
          setError('Не удалось связаться с сервером. Проверьте интернет и попробуйте снова.');
        } else if (caughtError instanceof ApiError) {
          setError(caughtError.message);
        } else {
          setError('Не удалось подтвердить email. Попробуйте ещё раз.');
        }
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    if (!trimmedEmail || !password.trim() || (mode === 'register' && !name.trim())) {
      setError('Заполните все обязательные поля.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'login') {
        await signIn({ email: trimmedEmail, password });
      } else {
        await signUp({ email: trimmedEmail, name: name.trim(), password });
        setVerificationCode('');
        setMode('verify');
      }
    } catch (caughtError) {
      if (caughtError instanceof ApiConnectionError) {
        setError('Сервер временно недоступен. Попробуйте ещё раз через минуту.');
      } else if (caughtError instanceof ApiError) {
        const verificationPayload = readVerificationPayload(caughtError);
        if (verificationPayload?.verificationRequired) {
          setMode('verify');
          if (verificationPayload.email) {
            setEmail(verificationPayload.email);
          }
        }
        setError(caughtError.message);
      } else {
        setError('Не удалось выполнить запрос. Попробуйте ещё раз.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Сначала введите email.');
      return;
    }

    setIsResending(true);
    setError(null);

    try {
      await resendVerificationCode(trimmedEmail);
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError('Не удалось отправить код ещё раз.');
      }
    } finally {
      setIsResending(false);
    }
  };

  const switchTo = (nextMode: Extract<Mode, 'login' | 'register'>) => {
    clearPendingVerification();
    setMode(nextMode);
    setVerificationCode('');
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Cinema Notes</Text>
          <Text style={styles.title}>
            {mode === 'verify' ? 'Подтвердите email' : 'Войдите или создайте аккаунт'}
          </Text>
          <Text style={styles.subtitle}>
            {mode === 'verify'
              ? 'Мы отправили код на вашу почту. После подтверждения можно искать фильмы, создавать комнаты и смотреть вместе.'
              : 'Зарегистрируйтесь, найдите фильм или аниме, откройте комнату и смотрите синхронно с другом.'}
          </Text>
        </View>

        {mode !== 'verify' ? (
          <View style={styles.switchRow}>
            <Pressable
              onPress={() => switchTo('login')}
              style={[styles.switchButton, mode === 'login' && styles.switchButtonActive]}>
              <Text style={[styles.switchText, mode === 'login' && styles.switchTextActive]}>
                Войти
              </Text>
            </Pressable>
            <Pressable
              onPress={() => switchTo('register')}
              style={[styles.switchButton, mode === 'register' && styles.switchButtonActive]}>
              <Text style={[styles.switchText, mode === 'register' && styles.switchTextActive]}>
                Регистрация
              </Text>
            </Pressable>
          </View>
        ) : null}

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
            editable={!isSubmitting}
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={AppColors.textSecondary}
            style={styles.input}
            value={email}
          />

          {mode === 'verify' ? (
            <>
              <TextInput
                keyboardType="number-pad"
                maxLength={6}
                onChangeText={setVerificationCode}
                placeholder="Код из письма"
                placeholderTextColor={AppColors.textSecondary}
                style={styles.input}
                value={verificationCode}
              />
              <Text style={styles.helperText}>{verificationHint}</Text>
              {pendingVerification?.debugCode ? (
                <Text style={styles.debugText}>Тестовый код: {pendingVerification.debugCode}</Text>
              ) : null}
            </>
          ) : (
            <TextInput
              onChangeText={setPassword}
              placeholder="Пароль"
              placeholderTextColor={AppColors.textSecondary}
              secureTextEntry
              style={styles.input}
              value={password}
            />
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable onPress={() => void handleSubmit()} style={styles.submitButton}>
            {isSubmitting ? (
              <ActivityIndicator color={AppColors.textPrimary} />
            ) : (
              <Text style={styles.submitButtonText}>
                {mode === 'login'
                  ? 'Войти'
                  : mode === 'register'
                    ? 'Отправить код'
                    : 'Подтвердить и продолжить'}
              </Text>
            )}
          </Pressable>

          {mode === 'verify' ? (
            <View style={styles.verifyActions}>
              <Pressable onPress={() => void handleResendCode()} style={styles.secondaryButton}>
                {isResending ? (
                  <ActivityIndicator color={AppColors.textPrimary} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Отправить код ещё раз</Text>
                )}
              </Pressable>
              <Pressable onPress={() => switchTo('login')} style={styles.inlineButton}>
                <Text style={styles.inlineButtonText}>Вернуться ко входу</Text>
              </Pressable>
            </View>
          ) : null}
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
  debugText: {
    color: AppColors.warning,
    fontSize: 13,
    lineHeight: 20,
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
  helperText: {
    color: AppColors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  hero: {
    gap: 10,
  },
  inlineButton: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  inlineButtonText: {
    color: AppColors.accentSecondary,
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 15,
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
  verifyActions: {
    gap: 8,
  },
});
