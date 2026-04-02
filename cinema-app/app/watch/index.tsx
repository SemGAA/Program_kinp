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
import {
  acceptWatchRoomInvite,
  ApiError,
  getWatchRoomInvites,
  getWatchRooms,
  joinWatchRoom,
  rejectWatchRoomInvite,
} from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import type { WatchRoomInvitesPayload, WatchRoomSummary } from '@/types/app';

export default function WatchRoomsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [rooms, setRooms] = useState<WatchRoomSummary[]>([]);
  const [invites, setInvites] = useState<WatchRoomInvitesPayload>({ incoming: [], outgoing: [] });
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [roomsPayload, invitesPayload] = await Promise.all([
          getWatchRooms(token),
          getWatchRoomInvites(token),
        ]);
        setRooms(roomsPayload);
        setInvites(invitesPayload);
      } catch (caughtError) {
        setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить комнаты.');
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, [token]);

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

  const handleInviteResponse = async (inviteId: number, action: 'accept' | 'reject') => {
    if (!token) {
      return;
    }

    try {
      if (action === 'accept') {
        const room = await acceptWatchRoomInvite(inviteId, token);
        router.push({
          pathname: '/watch/[code]',
          params: {
            code: room.code,
            initialRoom: JSON.stringify(room),
          },
        });
        return;
      }

      await rejectWatchRoomInvite(inviteId, token);
      setInvites((currentValue) => ({
        ...currentValue,
        incoming: currentValue.incoming.filter((invite) => invite.id !== inviteId),
      }));
    } catch (caughtError) {
      Alert.alert(
        'Ошибка',
        caughtError instanceof ApiError ? caughtError.message : 'Не удалось обработать приглашение.',
      );
    }
  };

  return (
    <AppShell
      title="Комнаты"
      subtitle="Входите по коду или принимайте приглашение от друга. Демо-комнаты больше не нужны: комната создаётся прямо из карточки выбранного тайтла.">
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
      </View>

      {error ? (
        <View style={sharedStyles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {invites.incoming.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Приглашения</Text>
          {invites.incoming.map((invite) => (
            <View key={invite.id} style={[sharedStyles.card, styles.inviteCard]}>
              <Text style={styles.roomTitle}>{invite.room.movieTitle}</Text>
              <Text style={sharedStyles.helperText}>
                От {invite.sender?.name ?? 'друга'} • код {invite.room.code}
              </Text>
              <Text style={styles.metaText}>Отправлено {formatShortDate(invite.createdAt)}</Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void handleInviteResponse(invite.id, 'accept')}
                  style={[sharedStyles.primaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.primaryButtonText}>Принять</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleInviteResponse(invite.id, 'reject')}
                  style={[sharedStyles.secondaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.secondaryButtonText}>Отклонить</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {invites.outgoing.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Отправленные приглашения</Text>
          {invites.outgoing.map((invite) => (
            <View key={invite.id} style={[sharedStyles.card, styles.inviteCard]}>
              <Text style={styles.roomTitle}>{invite.room.movieTitle}</Text>
              <Text style={sharedStyles.helperText}>
                Для {invite.recipient?.name ?? 'друга'} • код {invite.room.code}
              </Text>
              <Text style={styles.metaText}>Ожидает ответа с {formatShortDate(invite.createdAt)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <View style={sharedStyles.card}>
          <ActivityIndicator color={AppColors.accent} />
        </View>
      ) : null}

      {!isLoading && rooms.length === 0 && invites.incoming.length === 0 && invites.outgoing.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>
            Пока нет активных комнат. Откройте карточку фильма или сериала и создайте комнату просмотра.
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
                {room.mediaType === 'tv' ? 'Сериал' : 'Фильм'} • код {room.code} • участников {room.memberCount}
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
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  flexButton: {
    flex: 1,
  },
  heroCard: {
    gap: 12,
  },
  inviteCard: {
    gap: 10,
  },
  metaText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
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
  sectionBlock: {
    gap: 12,
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
