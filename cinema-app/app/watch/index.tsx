import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  acceptWatchRoomInvite,
  ApiError,
  deleteWatchRoom,
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
  const [deletingRoomCode, setDeletingRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);

  const loadData = useCallback(async () => {
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
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handleJoinRoom = async () => {
    if (!token) {
      return;
    }

    if (!joinCode.trim()) {
      Alert.alert('Нужен код комнаты', 'Введите код комнаты, который вам отправил друг.');
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
          params: { code: room.code },
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
        caughtError instanceof ApiError
          ? caughtError.message
          : 'Не удалось обработать приглашение.',
      );
    }
  };

  const handleDeleteRoom = (room: WatchRoomSummary) => {
    if (!token) {
      return;
    }

    Alert.alert(
      room.isHost ? 'Удалить комнату?' : 'Убрать комнату?',
      room.isHost
        ? `Комната «${room.movieTitle}» удалится для всех участников.`
        : `Комната «${room.movieTitle}» исчезнет из вашего списка.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: room.isHost ? 'Удалить' : 'Убрать',
          style: 'destructive',
          onPress: async () => {
            setDeletingRoomCode(room.code);
            setError(null);

            try {
              await deleteWatchRoom(room.code, token);
              setRooms((currentValue) => currentValue.filter((item) => item.code !== room.code));
            } catch (caughtError) {
              if (caughtError instanceof ApiError && caughtError.status === 404) {
                setRooms((currentValue) => currentValue.filter((item) => item.code !== room.code));
                Alert.alert(
                  'Комната скрыта',
                  'Комната убрана из списка на этом устройстве. Полное удаление с сервера включится после обновления API.',
                );
                return;
              }

              Alert.alert(
                'Ошибка',
                caughtError instanceof ApiError
                  ? caughtError.message
                  : 'Не удалось удалить комнату.',
              );
            } finally {
              setDeletingRoomCode(null);
            }
          },
        },
      ],
    );
  };

  return (
    <AppShell
      title="Комнаты"
      subtitle="Активные совместные просмотры, приглашения и быстрый вход по коду. Комнату теперь можно удалить или убрать из списка.">
      <View style={[sharedStyles.card, styles.heroCard]}>
        <Text style={styles.sectionTitle}>Войти по коду</Text>
        <TextInput
          autoCapitalize="characters"
          onChangeText={setJoinCode}
          placeholder="Например AB12CD"
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
          <Text style={styles.sectionTitle}>Входящие приглашения</Text>
          {invites.incoming.map((invite) => (
            <View key={invite.id} style={[sharedStyles.card, styles.inviteCard]}>
              <View style={styles.inviteHeader}>
                <AvatarBadge
                  avatarTheme={invite.sender?.avatarTheme}
                  avatarUrl={invite.sender?.avatarUrl}
                  label={invite.sender?.name ?? 'П'}
                  size={44}
                />
                <View style={styles.inviteCopy}>
                  <Text style={styles.roomTitle}>{invite.room.movieTitle}</Text>
                  <Text style={sharedStyles.helperText}>
                    От {invite.sender?.name ?? 'друга'} · код {invite.room.code}
                  </Text>
                  <Text style={styles.metaText}>Получено {formatShortDate(invite.createdAt)}</Text>
                </View>
              </View>
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
                Для {invite.recipient?.name ?? 'друга'} · код {invite.room.code}
              </Text>
              <Text style={styles.metaText}>Отправлено {formatShortDate(invite.createdAt)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <View style={sharedStyles.card}>
          <ActivityIndicator color={AppColors.accent} />
        </View>
      ) : null}

      {!isLoading &&
      rooms.length === 0 &&
      invites.incoming.length === 0 &&
      invites.outgoing.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>
            Пока нет активных комнат. Откройте поиск, выберите фильм или видео и нажмите «Смотреть».
          </Text>
        </View>
      ) : null}

      {rooms.map((room) => (
        <View key={room.code} style={[sharedStyles.card, styles.roomCard]}>
          <Pressable onPress={() => router.push(`/watch/${room.code}`)} style={styles.roomTapArea}>
            <View style={styles.roomHeader}>
              <View style={styles.roomCopy}>
                <Text style={styles.roomTitle}>{room.movieTitle}</Text>
                <Text style={sharedStyles.helperText}>
                  {room.mediaType === 'tv' ? 'Сериал' : 'Фильм'} · код {room.code} · участников{' '}
                  {room.memberCount}
                </Text>
                <Text style={sharedStyles.helperText}>
                  {room.isHost ? 'Вы ведущий' : `Ведущий: ${room.host?.name ?? 'неизвестен'}`}
                </Text>
              </View>
              <View style={styles.statePill}>
                <Text style={styles.statePillText}>
                  {room.playback.state === 'playing'
                    ? 'Смотрим'
                    : room.playback.state === 'ended'
                      ? 'Завершено'
                      : 'Пауза'}
                </Text>
              </View>
            </View>
            <Text style={styles.metaText}>
              {room.source?.label ?? 'Источник будет показан после открытия комнаты'}
            </Text>
          </Pressable>

          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.push(`/watch/${room.code}`)}
              style={[sharedStyles.primaryButton, styles.flexButton]}>
              <Text style={sharedStyles.primaryButtonText}>Открыть</Text>
            </Pressable>
            <Pressable
              onPress={() => handleDeleteRoom(room)}
              style={[sharedStyles.secondaryButton, styles.flexButton]}>
              {deletingRoomCode === room.code ? (
                <ActivityIndicator color={AppColors.textPrimary} />
              ) : (
                <Text style={sharedStyles.secondaryButtonText}>
                  {room.isHost ? 'Удалить' : 'Убрать'}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
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
  inviteCopy: {
    flex: 1,
    gap: 4,
  },
  inviteHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  metaText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  roomCard: {
    gap: 12,
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
  roomTapArea: {
    gap: 8,
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
