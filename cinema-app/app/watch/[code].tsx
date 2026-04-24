import { ResizeMode, type AVPlaybackStatus, Video } from 'expo-av';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  ApiError,
  getFriends,
  getWatchRoom,
  inviteToWatchRoom,
  sendWatchRoomMessage,
  syncWatchRoomPlayback,
  updateWatchRoomSource,
} from '@/lib/api';
import { EXTERNAL_STREAM_ENDPOINT, resolveAutoVideoMatch } from '@/lib/auto-video';
import { getStoredJellyfinConnection } from '@/lib/jellyfin';
import type { Friend, VideoSource, WatchPlayback, WatchRoom, WatchRoomMessage } from '@/types/app';

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isRecentTimestamp(value: string | null, maxAgeMs = 15000) {
  if (!value) {
    return false;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= maxAgeMs;
}

function formatMessageTime(value: string | null) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WatchRoomScreen() {
  const router = useRouter();
  const { code: codeParam } = useLocalSearchParams<{ code: string }>();
  const code = (readParam(codeParam) ?? '').toUpperCase();
  const { token, user } = useAuth();
  const videoRef = useRef<Video | null>(null);
  const chatListRef = useRef<FlatList<WatchRoomMessage> | null>(null);
  const applyingRemoteRef = useRef(false);
  const autoConnectAttemptRef = useRef<string | null>(null);
  const lastSentRef = useRef<{ positionMs: number; sentAt: number; state: WatchPlayback['state'] } | null>(
    null,
  );

  const [room, setRoom] = useState<WatchRoom | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasJellyfin, setHasJellyfin] = useState(false);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [isConnectingSource, setIsConnectingSource] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<number | null>(null);
  const [messageBody, setMessageBody] = useState('');
  const [messageKind, setMessageKind] = useState<'chat' | 'note'>('chat');
  const hasExternalProvider = Boolean(EXTERNAL_STREAM_ENDPOINT);
  const canAutoResolveSource = hasJellyfin || hasExternalProvider;

  const source: VideoSource = room?.source ?? {
    embedUrl: null,
    embeddable: false,
    kind: 'none',
    label: 'Источник не подключён',
    provider: null,
    videoId: null,
  };

  const visibleMessages = useMemo(
    () => (room?.messages ?? []).filter((message) => message.kind !== 'system'),
    [room?.messages],
  );

  const latestOverlayMessage = useMemo(() => {
    return [...visibleMessages].reverse().find((item) => isRecentTimestamp(item.createdAt)) ?? null;
  }, [visibleMessages]);

  useEffect(() => {
    if (visibleMessages.length === 0) {
      return;
    }

    const timer = setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(timer);
  }, [visibleMessages.length]);

  const loadRoom = useCallback(async () => {
    if (!token || !code) {
      return null;
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

  const loadFriends = useCallback(
    async (isHost = room?.isHost ?? false) => {
      if (!token || !isHost) {
        setFriends([]);
        return;
      }

      try {
        setFriends(await getFriends(token));
      } catch {
        setFriends([]);
      }
    },
    [room?.isHost, token],
  );

  const pushPlayback = useCallback(
    async (payload: {
      playback_position_ms: number;
      playback_rate?: number;
      playback_state: WatchPlayback['state'];
    }) => {
      if (!token || !room?.isHost || source.kind !== 'direct') {
        return;
      }

      const now = Date.now();
      const previous = lastSentRef.current;
      const shouldSend =
        !previous ||
        previous.state !== payload.playback_state ||
        Math.abs(previous.positionMs - payload.playback_position_ms) > 1500 ||
        now - previous.sentAt > 2000;

      if (!shouldSend) {
        return;
      }

      lastSentRef.current = {
        positionMs: payload.playback_position_ms,
        sentAt: now,
        state: payload.playback_state,
      };

      try {
        await syncWatchRoomPlayback(room.code, payload, token);
      } catch {
        // Синхронизация не должна останавливать само видео из-за временной сети.
      }
    },
    [room?.code, room?.isHost, source.kind, token],
  );

  const applyRemotePlayback = useCallback(async (nextRoom: WatchRoom | null) => {
    if (!nextRoom || nextRoom.isHost || nextRoom.source.kind !== 'direct' || !nextRoom.hasVideoSource) {
      return;
    }

    if (!videoRef.current) {
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
  }, []);

  const handleConnectBuiltInSource = useCallback(
    async (manual = false) => {
      if (!room || !token || !room.isHost || room.hasVideoSource) {
        return;
      }

      setIsConnectingSource(true);
      setError(null);

      try {
        const resolvedMatch = await resolveAutoVideoMatch({
          mediaType: room.mediaType,
          releaseYear: room.releaseYear,
          title: room.movieTitle,
          tmdbId: room.tmdbId,
        });

        if (!resolvedMatch?.streamUrl) {
          if (manual) {
            Alert.alert(
              'Источник не найден',
              hasExternalProvider
                ? 'Jellyfin и настроенный внешний провайдер не нашли поток для этой комнаты.'
                : 'Для обычных фильмов, сериалов и аниме нужен легальный поток: например, ваша медиатека Jellyfin. Открытые видео из Internet Archive запускаются сразу.',
            );
          }
          return;
        }

        const updatedRoom = await updateWatchRoomSource(room.code, resolvedMatch.streamUrl, token);
        setRoom(updatedRoom);

        if (manual) {
          Alert.alert(
            'Источник подключён',
            `Видео можно смотреть прямо в комнате. Провайдер: ${resolvedMatch.providerLabel}.`,
          );
        }
      } catch (caughtError) {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : 'Не удалось подключить встроенный источник.',
        );
      } finally {
        setIsConnectingSource(false);
      }
    },
    [hasExternalProvider, room, token],
  );

  useEffect(() => {
    let isMounted = true;

    void getStoredJellyfinConnection()
      .then((connection) => {
        if (isMounted) {
          setHasJellyfin(Boolean(connection));
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasJellyfin(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      const payload = await loadRoom();
      if (!isMounted || !payload) {
        return;
      }

      await loadFriends(payload.isHost);
      void applyRemotePlayback(payload);
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
  }, [applyRemotePlayback, loadFriends, loadRoom]);

  useEffect(() => {
    if (!room || !room.isHost || room.hasVideoSource || !canAutoResolveSource) {
      return;
    }

    if (autoConnectAttemptRef.current === room.code) {
      return;
    }

    autoConnectAttemptRef.current = room.code;
    void handleConnectBuiltInSource(false);
  }, [canAutoResolveSource, handleConnectBuiltInSource, room]);

  const handleDirectPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (
        !status.isLoaded ||
        !room?.isHost ||
        !room.videoUrl ||
        source.kind !== 'direct' ||
        applyingRemoteRef.current
      ) {
        return;
      }

      const nextState: WatchPlayback['state'] = status.didJustFinish
        ? 'ended'
        : status.isPlaying
          ? 'playing'
          : 'paused';

      void pushPlayback({
        playback_position_ms: status.positionMillis ?? 0,
        playback_rate: status.rate ?? 1,
        playback_state: nextState,
      });
    },
    [pushPlayback, room?.isHost, room?.videoUrl, source.kind],
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

      setRoom((currentValue) =>
        currentValue
          ? {
              ...currentValue,
              messages: [...currentValue.messages, message],
            }
          : currentValue,
      );
      setMessageBody('');
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : 'Не удалось отправить сообщение.',
      );
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleShareRoom = async () => {
    if (!room) {
      return;
    }

    await Share.share({
      message: room.share.inviteText,
      title: `Cinema Notes - ${room.movieTitle}`,
    });
  };

  const handleOpenExternalSource = useCallback(async () => {
    const nextUrl = room?.videoUrl || source.embedUrl;
    if (!nextUrl) {
      return;
    }

    try {
      await Linking.openURL(nextUrl);
    } catch {
      setError('Не удалось открыть внешний источник.');
    }
  }, [room?.videoUrl, source.embedUrl]);

  const handleInviteFriend = async (friendId: number) => {
    if (!token || !room) {
      return;
    }

    setInvitingFriendId(friendId);
    setError(null);

    try {
      await inviteToWatchRoom(room.code, friendId, token);
      Alert.alert('Приглашение отправлено', 'Друг получит приглашение внутри приложения.');
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : 'Не удалось отправить приглашение.',
      );
    } finally {
      setInvitingFriendId(null);
    }
  };

  const handleOpenInvitePicker = () => {
    if (!room?.isHost) {
      void handleShareRoom();
      return;
    }

    if (friends.length === 0) {
      Alert.alert(
        'Нет друзей для приглашения',
        'Добавьте друга во вкладке «Друзья» или отправьте ссылку через кнопку «Поделиться».',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Поделиться', onPress: () => void handleShareRoom() },
        ],
      );
      return;
    }

    Alert.alert(
      'Пригласить друга',
      'Выберите друга или отправьте ссылку в любой мессенджер.',
      [
        { text: 'Поделиться ссылкой', onPress: () => void handleShareRoom() },
        ...friends.slice(0, 6).map((friend) => ({
          text: invitingFriendId === friend.id ? `${friend.name}...` : friend.name,
          onPress: () => void handleInviteFriend(friend.id),
        })),
        { text: 'Отмена', style: 'cancel' },
      ],
    );
  };

  const handleShowMembers = () => {
    if (!room) {
      return;
    }

    const membersText = room.members
      .map((member) => {
        const marks = [
          member.id === room.host?.id ? 'ведущий' : null,
          member.id === user?.id ? 'это вы' : null,
        ]
          .filter(Boolean)
          .join(', ');

        return marks ? `${member.name} (${marks})` : member.name;
      })
      .join('\n');

    Alert.alert('Участники комнаты', membersText || 'Пока никого нет.');
  };

  const renderPlayer = () => {
    if (!room) {
      return null;
    }

    if (source.kind === 'direct' && room.videoUrl) {
      return (
        <Video
          ref={videoRef}
          source={{ uri: room.videoUrl }}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay={room.isHost ? false : room.playback.state === 'playing'}
          style={styles.video}
          useNativeControls={room.isHost}
          onPlaybackStatusUpdate={handleDirectPlaybackStatusUpdate}
        />
      );
    }

    if ((source.kind === 'youtube' || source.kind === 'external') && room.videoUrl) {
      return (
        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderTitle}>{source.label}</Text>
          <Text style={styles.placeholderBody}>
            Этот источник открывается во внешнем сервисе. Встроенный плеер для него отключён, чтобы не было ошибки 153 и вылетов.
          </Text>
          <Pressable onPress={() => void handleOpenExternalSource()} style={styles.playerButton}>
            <Text style={styles.playerButtonText}>Открыть источник</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.placeholderCard}>
        <Text style={styles.placeholderTitle}>Комната готова</Text>
        <Text style={styles.placeholderBody}>
          Чат и приглашения уже работают. Видео появится здесь, если выбранный тайтл найден в легальном открытом источнике или в вашей Jellyfin-медиатеке.
        </Text>
      </View>
    );
  };

  const renderMessage = ({ item }: { item: WatchRoomMessage }) => {
    const isCurrentUser = item.user?.id === user?.id;

    return (
      <View style={[styles.messageBubble, isCurrentUser ? styles.messageBubbleMine : null]}>
        <View style={styles.messageHeader}>
          <Text style={styles.messageAuthor}>
            {(item.user?.name ?? 'Пользователь') + (item.kind === 'note' ? ' · заметка' : '')}
          </Text>
          <Text style={styles.messageTime}>{formatMessageTime(item.createdAt)}</Text>
        </View>
        <Text style={styles.messageBody}>{item.body}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
        style={styles.root}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Назад</Text>
          </Pressable>

          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>
              {room?.movieTitle ?? 'Комната просмотра'}
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {room ? `Код ${room.code} · ${room.memberCount} участн.` : 'Загружаем комнату...'}
            </Text>
          </View>

          <Pressable onPress={() => void handleShareRoom()} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Поделиться</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={AppColors.accent} />
            <Text style={styles.centerText}>Загружаем комнату...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {room ? (
          <>
            <View style={[styles.playerPane, isCinemaMode && styles.playerPaneCinema]}>
              <View style={styles.infoRow}>
                <View style={styles.infoPill}>
                  <Text numberOfLines={1} style={styles.infoPillText}>
                    {room.hasVideoSource ? source.label : 'Источник не подключён'}
                  </Text>
                </View>
                <View style={styles.infoPill}>
                  <Text style={styles.infoPillText}>
                    {room.playback.state === 'playing'
                      ? 'Сейчас идёт'
                      : room.playback.state === 'ended'
                        ? 'Завершено'
                        : 'Пауза'}
                  </Text>
                </View>
              </View>

              <View style={[styles.playerFrame, isCinemaMode && styles.playerFrameCinema]}>
                {renderPlayer()}

                {latestOverlayMessage ? (
                  <View style={styles.overlayToast}>
                    <Text style={styles.overlayAuthor}>{latestOverlayMessage.user?.name ?? 'Гость'}</Text>
                    <Text numberOfLines={2} style={styles.overlayBody}>
                      {latestOverlayMessage.body}
                    </Text>
                  </View>
                ) : null}
              </View>

              {!room.hasVideoSource ? (
                <View style={styles.sourceHint}>
                  <Text style={styles.sourceHintText}>
                    Встроенный просмотр работает с открытыми видео, Jellyfin и настроенным внешним провайдером.
                  </Text>
                  <Pressable
                    onPress={() =>
                      canAutoResolveSource
                        ? void handleConnectBuiltInSource(true)
                        : router.push('/media-server')
                    }
                    style={styles.sourceHintButton}>
                    {isConnectingSource ? (
                      <ActivityIndicator color={AppColors.textPrimary} />
                    ) : (
                      <Text style={styles.sourceHintButtonText}>
                        {canAutoResolveSource ? 'Найти источник' : 'Настроить Jellyfin'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.chatPane}>
              <View style={styles.chatHeader}>
                <View>
                  <Text style={styles.chatTitle}>Чат</Text>
                </View>
                <View style={styles.chatActions}>
                  <Pressable onPress={() => setIsCinemaMode((value) => !value)} style={styles.smallButton}>
                    <Text style={styles.smallButtonText}>{isCinemaMode ? 'Обычный' : 'Кино'}</Text>
                  </Pressable>
                  <Pressable onPress={handleShowMembers} style={styles.smallButton}>
                    <Text style={styles.smallButtonText}>Участники</Text>
                  </Pressable>
                  <Pressable onPress={handleOpenInvitePicker} style={styles.smallButtonPrimary}>
                    <Text style={styles.smallButtonPrimaryText}>Пригласить</Text>
                  </Pressable>
                </View>
              </View>

              <FlatList
                ref={chatListRef}
                data={visibleMessages}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={styles.emptyChat}>
                    <Text style={styles.emptyChatText}>
                      Сообщений пока нет. Напишите первым и обсуждайте просмотр прямо во время видео.
                    </Text>
                  </View>
                }
                onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
                renderItem={renderMessage}
                style={styles.chatList}
                contentContainerStyle={[
                  styles.chatListContent,
                  visibleMessages.length === 0 ? styles.chatListContentEmpty : null,
                ]}
              />

              <View style={styles.composer}>
                <View style={styles.kindRow}>
                  <Pressable
                    onPress={() => setMessageKind('chat')}
                    style={[styles.kindButton, messageKind === 'chat' && styles.kindButtonActive]}>
                    <Text style={[styles.kindText, messageKind === 'chat' && styles.kindTextActive]}>Чат</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMessageKind('note')}
                    style={[styles.kindButton, messageKind === 'note' && styles.kindButtonActive]}>
                    <Text style={[styles.kindText, messageKind === 'note' && styles.kindTextActive]}>Заметка</Text>
                  </Pressable>
                </View>

                <View style={styles.composerRow}>
                  <TextInput
                    multiline
                    onChangeText={setMessageBody}
                    placeholder="Написать сообщение..."
                    placeholderTextColor={AppColors.textSecondary}
                    style={styles.messageInput}
                    value={messageBody}
                  />
                  <Pressable
                    disabled={isSendingMessage || !messageBody.trim()}
                    onPress={() => void handleSendMessage()}
                    style={[
                      styles.sendButton,
                      (!messageBody.trim() || isSendingMessage) && styles.sendButtonDisabled,
                    ]}>
                    {isSendingMessage ? (
                      <ActivityIndicator color={AppColors.textPrimary} />
                    ) : (
                      <Text style={styles.sendButtonText}>Отпр.</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  centerText: {
    color: AppColors.textSecondary,
    fontSize: 14,
  },
  chatActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: 190,
  },
  chatHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  chatList: {
    flex: 1,
  },
  chatListContent: {
    gap: 10,
    padding: 14,
    paddingTop: 10,
  },
  chatListContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  chatPane: {
    backgroundColor: '#0E1728',
    borderColor: AppColors.border,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    flex: 1,
    marginTop: 10,
    overflow: 'hidden',
  },
  chatSubtitle: {
    color: AppColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    maxWidth: 190,
  },
  chatTitle: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  composer: {
    backgroundColor: '#101A2D',
    borderTopColor: AppColors.border,
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 10,
  },
  composerRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  emptyChat: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyChatText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(255, 154, 139, 0.12)',
    borderColor: 'rgba(255, 154, 139, 0.35)',
    borderRadius: 18,
    borderWidth: 1,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 12,
  },
  errorText: {
    color: '#FFB0A5',
    fontSize: 14,
    lineHeight: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: 12,
  },
  headerButtonText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  headerCopy: {
    flex: 1,
  },
  infoPill: {
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '68%',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  infoPillText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kindButton: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  kindButtonActive: {
    borderColor: AppColors.accent,
  },
  kindRow: {
    flexDirection: 'row',
    gap: 8,
  },
  kindText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  kindTextActive: {
    color: AppColors.textPrimary,
  },
  messageAuthor: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  messageBody: {
    color: AppColors.textPrimary,
    fontSize: 15,
    lineHeight: 21,
  },
  messageBubble: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.card,
    borderColor: AppColors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    maxWidth: '86%',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  messageBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#172A45',
    borderColor: AppColors.accent,
  },
  messageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  messageInput: {
    backgroundColor: '#0B1322',
    borderColor: AppColors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: AppColors.textPrimary,
    flex: 1,
    fontSize: 15,
    maxHeight: 96,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  messageTime: {
    color: AppColors.textSecondary,
    fontSize: 11,
  },
  overlayAuthor: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  overlayBody: {
    color: AppColors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  overlayToast: {
    backgroundColor: 'rgba(10, 14, 24, 0.82)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    bottom: 12,
    left: 12,
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: 'absolute',
  },
  placeholderBody: {
    color: AppColors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  placeholderCard: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: '#08101E',
    gap: 12,
    justifyContent: 'center',
    padding: 20,
  },
  placeholderTitle: {
    color: AppColors.textPrimary,
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  playerButton: {
    alignItems: 'center',
    backgroundColor: AppColors.accent,
    borderRadius: 16,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  playerButtonText: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  playerFrame: {
    aspectRatio: 16 / 9,
    backgroundColor: '#08101E',
    borderColor: AppColors.border,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
  playerFrameCinema: {
    aspectRatio: 16 / 10,
  },
  playerPane: {
    flexShrink: 0,
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  playerPaneCinema: {
    paddingTop: 2,
  },
  root: {
    flex: 1,
  },
  safeArea: {
    backgroundColor: AppColors.background,
    flex: 1,
  },
  sendButton: {
    alignItems: 'center',
    backgroundColor: AppColors.accent,
    borderRadius: 17,
    justifyContent: 'center',
    minHeight: 46,
    minWidth: 72,
    paddingHorizontal: 12,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendButtonText: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '900',
  },
  smallButton: {
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  smallButtonPrimary: {
    backgroundColor: AppColors.accent,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  smallButtonPrimaryText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  smallButtonText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  sourceHint: {
    alignItems: 'stretch',
    backgroundColor: '#101A2D',
    borderColor: AppColors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 10,
  },
  sourceHintButton: {
    alignItems: 'center',
    backgroundColor: AppColors.accent,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 120,
    paddingHorizontal: 10,
  },
  sourceHintButtonText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  sourceHintText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  subtitle: {
    color: AppColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  title: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '900',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#08101E',
  },
});
