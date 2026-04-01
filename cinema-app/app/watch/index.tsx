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
import { useAuth } from '@/hooks/use-auth';
import { ApiError, createWatchRoom, getWatchRooms, joinWatchRoom } from '@/lib/api';
import type { WatchRoomSummary } from '@/types/app';

const DEMO_VIDEO_URL = 'https://vjs.zencdn.net/v/oceans.mp4';

export default function WatchRoomsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [rooms, setRooms] = useState<WatchRoomSummary[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const payload = await getWatchRooms(token);
        setRooms(payload);
      } catch (caughtError) {
        setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить комнаты.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [token]);

  const handleCreateDemoRoom = async () => {
    if (!token) {
      return;
    }

    setIsCreatingDemo(true);
    setError(null);

    try {
      const room = await createWatchRoom(
        {
          movie_title: 'Демо-комната: Oceans',
          video_url: DEMO_VIDEO_URL,
        },
        token,
      );

      router.push(`/watch/${room.code}`);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось создать демо-комнату.');
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!token) {
      return;
    }

    if (!joinCode.trim()) {
      Alert.alert('Нужен код', 'Введите код комнаты, который отправил друг.');
      return;
    }

    setIsJoining(true);
    setError(null);

    try {
      const room = await joinWatchRoom(joinCode.trim(), token);
      router.push(`/watch/${room.code}`);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось войти в комнату.');
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <AppShell
      title="Комнаты"
      subtitle="Создавайте комнаты совместного просмотра, входите по коду и смотрите видео синхронно через интернет.">
      <View style={[sharedStyles.card, styles.heroCard]}>
        <Text style={styles.sectionTitle}>Войти по коду</Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setJoinCode}
          placeholder="Например, AB12CD"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={joinCode}
        />
        <Pressable onPress={() => void handleJoinRoom()} style={sharedStyles.primaryButton}>
          {isJoining ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.primaryButtonText}>Войти в комнату</Text>
          )}
        </Pressable>
        <Pressable onPress={() => void handleCreateDemoRoom()} style={sharedStyles.secondaryButton}>
          {isCreatingDemo ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.secondaryButtonText}>Создать демо-комнату</Text>
          )}
        </Pressable>
        <Text style={sharedStyles.helperText}>
          Для реального просмотра создавайте комнату из карточки фильма и вставляйте прямую ссылку на видео
          формата mp4 или m3u8.
        </Text>
      </View>

      {error ? (
        <View style={sharedStyles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={sharedStyles.card}>
          <ActivityIndicator color={AppColors.accent} />
        </View>
      ) : null}

      {!isLoading && rooms.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>
            Пока нет комнат. Откройте карточку фильма из поиска или создайте демо-комнату для проверки.
          </Text>
        </View>
      ) : null}

      {rooms.map((room) => (
        <Pressable
          key={room.code}
          onPress={() => router.push(`/watch/${room.code}`)}
          style={[sharedStyles.card, styles.roomCard]}>
          <View style={styles.roomHeader}>
            <View style={styles.roomCopy}>
              <Text style={styles.roomTitle}>{room.movieTitle}</Text>
              <Text style={sharedStyles.helperText}>
                Код {room.code} • участников {room.memberCount}
              </Text>
              <Text style={sharedStyles.helperText}>
                {room.isHost ? 'Вы хозяин комнаты' : `Хозяин: ${room.host?.name ?? 'неизвестно'}`}
              </Text>
            </View>
            <View style={styles.statePill}>
              <Text style={styles.statePillText}>
                {room.playback.state === 'playing'
                  ? 'Идёт'
                  : room.playback.state === 'ended'
                    ? 'Завершено'
                    : 'Пауза'}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    gap: 12,
  },
  roomCard: {
    gap: 8,
  },
  roomCopy: {
    flex: 1,
    gap: 6,
  },
  roomHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  roomTitle: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  sectionTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  statePill: {
    backgroundColor: AppColors.cardMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statePillText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
