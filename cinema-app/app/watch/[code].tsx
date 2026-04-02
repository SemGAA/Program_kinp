import { ResizeMode, type AVPlaybackStatus, Video } from 'expo-av';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  getWatchRoom,
  sendWatchRoomMessage,
  syncWatchRoomPlayback,
} from '@/lib/api';
import type { WatchPlayback, WatchRoom } from '@/types/app';

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readInitialRoom(value: string | string[] | undefined): WatchRoom | null {
  const rawValue = readParam(value);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as WatchRoom;
  } catch {
    return null;
  }
}

export default function WatchRoomScreen() {
  const { code: codeParam, initialRoom: initialRoomParam } = useLocalSearchParams<{
    code: string;
    initialRoom?: string;
  }>();
  const code = (readParam(codeParam) ?? '').toUpperCase();
  const initialRoom = useMemo(() => readInitialRoom(initialRoomParam), [initialRoomParam]);
  const { token, user } = useAuth();
  const videoRef = useRef<Video | null>(null);
  const applyingRemoteRef = useRef(false);
  const lastSentRef = useRef<{ positionMs: number; state: WatchPlayback['state']; sentAt: number } | null>(
    null,
  );

  const [room, setRoom] = useState<WatchRoom | null>(initialRoom);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialRoom);
  const [messageBody, setMessageBody] = useState('');
  const [messageKind, setMessageKind] = useState<'chat' | 'note'>('chat');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isOpeningFullscreen, setIsOpeningFullscreen] = useState(false);

  const loadRoom = useCallback(async () => {
    if (!token || !code) {
      return;
    }

    try {
      const payload = await getWatchRoom(code, token);
      setRoom(payload);
      setError(null);
      return payload;
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить комнату.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [code, token]);

  const applyRemotePlayback = useCallback(
    async (nextRoom: WatchRoom | null) => {
      if (!videoRef.current || !nextRoom || nextRoom.isHost) {
        return;
      }

      applyingRemoteRef.current = true;

      try {
        const status = await videoRef.current.getStatusAsync();

        if (!status.isLoaded) {
          return;
        }

        const positionDelta = Math.abs((status.positionMillis ?? 0) - nextRoom.playback.positionMs);

        if (positionDelta > 1800) {
          await videoRef.current.setPositionAsync(nextRoom.playback.positionMs);
        }

        if (nextRoom.playback.state === 'playing' && !status.isPlaying) {
          await videoRef.current.playAsync();
        }

        if (
          (nextRoom.playback.state === 'paused' || nextRoom.playback.state === 'ended') &&
          status.isPlaying
        ) {
          await videoRef.current.pauseAsync();
        }
      } finally {
        setTimeout(() => {
          applyingRemoteRef.current = false;
        }, 250);
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const payload = await loadRoom();

      if (isMounted && payload) {
        void applyRemotePlayback(payload);
      }
    };

    void bootstrap();

    const interval = setInterval(() => {
      void loadRoom().then((payload) => {
        if (payload) {
          void applyRemotePlayback(payload);
        }
      });
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [applyRemotePlayback, loadRoom]);

  const handlePlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded || !token || !room?.isHost || applyingRemoteRef.current) {
        return;
      }

      const nextState: WatchPlayback['state'] = status.didJustFinish
        ? 'ended'
        : status.isPlaying
          ? 'playing'
          : 'paused';
      const nextPosition = status.positionMillis ?? 0;
      const now = Date.now();
      const previous = lastSentRef.current;
      const shouldSend =
        !previous ||
        previous.state !== nextState ||
        Math.abs(previous.positionMs - nextPosition) > 1500 ||
        now - previous.sentAt > 2000;

      if (!shouldSend) {
        return;
      }

      lastSentRef.current = {
        positionMs: nextPosition,
        sentAt: now,
        state: nextState,
      };

      void syncWatchRoomPlayback(
        room.code,
        {
          playback_position_ms: nextPosition,
          playback_rate: status.rate ?? 1,
          playback_state: nextState,
        },
        token,
      ).catch(() => undefined);
    },
    [room, token],
  );

  const handleSendMessage = async () => {
    if (!token || !room || !messageBody.trim()) {
      return;
    }

    setIsSendingMessage(true);
    setError(null);

    try {
      const message = await sendWatchRoomMessage(
        room.code,
        {
          body: messageBody.trim(),
          kind: messageKind,
        },
        token,
      );

      setRoom((currentRoom) =>
        currentRoom
          ? {
              ...currentRoom,
              messages: [...currentRoom.messages, message],
            }
          : currentRoom,
      );
      setMessageBody('');
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось отправить сообщение.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleShareRoom = async () => {
    if (!room) {
      return;
    }

    await Share.share({
      message: `Комната просмотра: ${room.movieTitle}\nКод комнаты: ${room.code}`,
      title: `Комната ${room.code}`,
    });
  };

  const handleOpenFullscreen = async () => {
    if (!videoRef.current) {
      return;
    }

    setIsOpeningFullscreen(true);

    try {
      await videoRef.current.presentFullscreenPlayer();
    } catch {
      setError('Не удалось открыть видео на весь экран.');
    } finally {
      setIsOpeningFullscreen(false);
    }
  };

  const sortedMessages = useMemo(() => room?.messages ?? [], [room?.messages]);

  return (
    <AppShell
      title={room?.movieTitle ?? 'Комната просмотра'}
      subtitle={
        room
          ? `Код ${room.code}. ${room.isHost ? 'Вы управляете воспроизведением.' : 'Управляет хозяин комнаты.'}`
          : 'Загрузка комнаты...'
      }>
      {isLoading ? (
        <View style={sharedStyles.card}>
          <ActivityIndicator color={AppColors.accent} />
        </View>
      ) : null}

      {error ? (
        <View style={sharedStyles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {room ? (
        <>
          <View style={[sharedStyles.card, styles.heroCard]}>
            <View style={styles.roomMeta}>
              <Text style={styles.roomCode}>Код: {room.code}</Text>
              <Pressable onPress={() => void handleShareRoom()} style={styles.shareButton}>
                <Text style={styles.shareButtonText}>Поделиться</Text>
              </Pressable>
            </View>
            <Text style={sharedStyles.helperText}>
              Хозяин: {room.host?.name ?? 'неизвестно'} • участников: {room.memberCount}
            </Text>
            <Video
              ref={videoRef}
              source={{ uri: room.videoUrl }}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={room.isHost ? false : room.playback.state === 'playing'}
              style={styles.video}
              useNativeControls={room.isHost}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            />
            <View style={styles.videoActionRow}>
              <Pressable onPress={() => void handleOpenFullscreen()} style={sharedStyles.secondaryButton}>
                {isOpeningFullscreen ? (
                  <ActivityIndicator color={AppColors.textPrimary} />
                ) : (
                  <Text style={sharedStyles.secondaryButtonText}>На весь экран</Text>
                )}
              </Pressable>
            </View>
            <Text style={sharedStyles.helperText}>
              {room.isHost
                ? 'Вы хозяин комнаты: используйте стандартные кнопки плеера для play/pause/seek.'
                : 'Вы зритель: плеер синхронизируется по состоянию хозяина комнаты.'}
            </Text>
          </View>

          <View style={[sharedStyles.card, styles.membersCard]}>
            <Text style={styles.sectionTitle}>Участники</Text>
            <View style={styles.memberRow}>
              {room.members.map((member) => (
                <View key={member.id} style={styles.memberPill}>
                  <Text style={styles.memberPillText}>
                    {member.name}
                    {member.id === room.host?.id ? ' • host' : ''}
                    {member.id === user?.id ? ' • вы' : ''}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[sharedStyles.card, styles.composerCard]}>
            <Text style={styles.sectionTitle}>Чат и заметки</Text>
            <View style={styles.kindRow}>
              <Pressable
                onPress={() => setMessageKind('chat')}
                style={[styles.kindButton, messageKind === 'chat' && styles.kindButtonActive]}>
                <Text style={[styles.kindText, messageKind === 'chat' && styles.kindTextActive]}>
                  Сообщение
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMessageKind('note')}
                style={[styles.kindButton, messageKind === 'note' && styles.kindButtonActive]}>
                <Text style={[styles.kindText, messageKind === 'note' && styles.kindTextActive]}>
                  Заметка
                </Text>
              </Pressable>
            </View>
            <TextInput
              multiline
              onChangeText={setMessageBody}
              placeholder="Напишите сообщение или заметку по фильму"
              placeholderTextColor={AppColors.textSecondary}
              style={[sharedStyles.input, styles.messageInput]}
              textAlignVertical="top"
              value={messageBody}
            />
            <Pressable onPress={() => void handleSendMessage()} style={sharedStyles.primaryButton}>
              {isSendingMessage ? (
                <ActivityIndicator color={AppColors.textPrimary} />
              ) : (
                <Text style={sharedStyles.primaryButtonText}>Отправить</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.messagesBlock}>
            {sortedMessages.length === 0 ? (
              <View style={sharedStyles.card}>
                <Text style={sharedStyles.emptyText}>
                  Пока нет сообщений. Добавьте заметку или напишите другу прямо во время просмотра.
                </Text>
              </View>
            ) : null}

            {sortedMessages.map((message) => {
              const isCurrentUser = message.user?.id === user?.id;

              return (
                <View
                  key={message.id}
                  style={[
                    sharedStyles.card,
                    styles.messageCard,
                    isCurrentUser ? styles.messageCardCurrent : null,
                  ]}>
                  <View style={styles.messageHeader}>
                    <Text style={styles.messageAuthor}>
                      {message.user?.name ?? 'Пользователь'} • {message.kind === 'note' ? 'заметка' : 'чат'}
                    </Text>
                    <Text style={styles.messageDate}>
                      {message.createdAt ? new Date(message.createdAt).toLocaleTimeString() : ''}
                    </Text>
                  </View>
                  <Text style={styles.messageBody}>{message.body}</Text>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  composerCard: {
    gap: 12,
  },
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    gap: 12,
  },
  kindButton: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
  },
  kindButtonActive: {
    borderColor: AppColors.accent,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kindText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  kindTextActive: {
    color: AppColors.textPrimary,
  },
  memberPill: {
    backgroundColor: AppColors.cardMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  memberPillText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  membersCard: {
    gap: 12,
  },
  messageAuthor: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  messageBody: {
    color: AppColors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
  },
  messageCard: {
    gap: 8,
  },
  messageCardCurrent: {
    borderColor: AppColors.accent,
  },
  messageDate: {
    color: AppColors.textSecondary,
    fontSize: 12,
  },
  messageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  messageInput: {
    minHeight: 110,
  },
  messagesBlock: {
    gap: 12,
  },
  roomCode: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  roomMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  shareButton: {
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  shareButtonText: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  video: {
    backgroundColor: '#000',
    borderRadius: 20,
    height: 220,
    overflow: 'hidden',
    width: '100%',
  },
  videoActionRow: {
    alignItems: 'flex-start',
  },
});
