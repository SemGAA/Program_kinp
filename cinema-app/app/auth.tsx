import { useState } from 'react';
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

type Mode = 'login' | 'register';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      if (caughtError instanceof ApiConnectionError) {
        setError('Сервер временно недоступен. Проверьте интернет и попробуйте ещё раз.');
      } else if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else {
        setError('Не удалось выполнить запрос. Попробуйте ещё раз.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Cinema Notes</Text>
          <Text style={styles.title}>Вход и регистрация</Text>
          <Text style={styles.subtitle}>
            Приложение само подключается к серверу. Пользователю нужен только аккаунт.
          </Text>
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
