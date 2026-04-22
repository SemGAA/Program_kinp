import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import {
  connectJellyfin,
  disconnectJellyfin,
  verifyJellyfinConnection,
  type JellyfinConnection,
} from '@/lib/jellyfin';

export default function MediaServerScreen() {
  const router = useRouter();
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<JellyfinConnection | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void verifyJellyfinConnection()
      .then((nextConnection) => {
        if (!isMounted) {
          return;
        }

        setConnection(nextConnection);
        setServerUrl(nextConnection?.serverUrl ?? '');
        setUsername(nextConnection?.username ?? '');
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setConnection(null);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleConnect = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const nextConnection = await connectJellyfin({
        password,
        serverUrl,
        username,
      });

      setConnection(nextConnection);
      setServerUrl(nextConnection.serverUrl);
      setUsername(nextConnection.username);
      setPassword('');

      Alert.alert('Jellyfin подключён', 'Теперь приложение сможет искать встроенный поток в вашей библиотеке.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось подключить Jellyfin.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      await disconnectJellyfin();
      setConnection(null);
      setPassword('');
      Alert.alert('Jellyfin отключён', 'Автоподключение встроенного источника выключено.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось отключить Jellyfin.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <AppShell
      title="Jellyfin"
      subtitle="Подключите свой медиасервер, и приложение сможет автоматически подставлять встроенный источник при создании комнаты.">
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Назад</Text>
      </Pressable>

      {isLoading ? (
        <View style={sharedStyles.card}>
          <ActivityIndicator color={AppColors.accent} />
        </View>
      ) : null}

      {connection ? (
        <View style={[sharedStyles.card, styles.statusCard]}>
          <Text style={styles.sectionTitle}>Подключение активно</Text>
          <Text style={sharedStyles.helperText}>Сервер: {connection.serverUrl}</Text>
          <Text style={sharedStyles.helperText}>Пользователь: {connection.username}</Text>
          <Text style={sharedStyles.helperText}>
            После подключения сценарий становится таким: нашли тайтл, нажали, и приложение попробует сразу открыть поток из вашей библиотеки Jellyfin.
          </Text>
        </View>
      ) : null}

      <View style={[sharedStyles.card, styles.formCard]}>
        <Text style={styles.sectionTitle}>Настройка сервера</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={setServerUrl}
          placeholder="https://your-jellyfin.example.com"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={serverUrl}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setUsername}
          placeholder="Логин Jellyfin"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={username}
        />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setPassword}
          placeholder="Пароль Jellyfin"
          placeholderTextColor={AppColors.textSecondary}
          secureTextEntry
          style={sharedStyles.input}
          value={password}
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable onPress={() => void handleConnect()} style={sharedStyles.primaryButton}>
          {isSaving ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.primaryButtonText}>Подключить Jellyfin</Text>
          )}
        </Pressable>

        {connection ? (
          <Pressable onPress={() => void handleDisconnect()} style={sharedStyles.secondaryButton}>
            {isDisconnecting ? (
              <ActivityIndicator color={AppColors.textPrimary} />
            ) : (
              <Text style={sharedStyles.secondaryButtonText}>Отключить</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={[sharedStyles.card, styles.helpCard]}>
        <Text style={styles.sectionTitle}>Как подключить</Text>
        <Text style={sharedStyles.helperText}>
          1. Откройте свой сервер Jellyfin в браузере.
        </Text>
        <Text style={sharedStyles.helperText}>
          2. Возьмите адрес сервера, например `https://my-jellyfin.example.com`.
        </Text>
        <Text style={sharedStyles.helperText}>
          3. Введите логин и пароль пользователя, у которого есть доступ к вашей библиотеке.
        </Text>
        <Text style={sharedStyles.helperText}>
          4. Нажмите `Подключить Jellyfin`.
        </Text>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    gap: 12,
  },
  helpCard: {
    gap: 8,
  },
  sectionTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  statusCard: {
    gap: 8,
  },
});
