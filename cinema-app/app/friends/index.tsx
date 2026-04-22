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
  acceptFriendRequest,
  ApiError,
  getFriendRequests,
  getFriends,
  rejectFriendRequest,
  removeFriend,
  searchUsers,
  sendFriendRequest,
} from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import type { Friend, FriendRequestsPayload, UserSearchResult } from '@/types/app';

export default function FriendsScreen() {
  const router = useRouter();
  const { refreshUser, token } = useAuth();
  const [query, setQuery] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequestsPayload>({ incoming: [], outgoing: [] });
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [friendsPayload, requestsPayload] = await Promise.all([
        getFriends(token),
        getFriendRequests(token),
      ]);
      setFriends(friendsPayload);
      setRequests(requestsPayload);
    } catch (caughtError) {
      const message = caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить друзей.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handleSearch = async () => {
    if (!token) {
      return;
    }

    if (query.trim().length < 2) {
      setError('Введите хотя бы 2 символа для поиска.');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const payload = await searchUsers(query.trim(), token);
      setSearchResults(payload);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось выполнить поиск.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (identifier: string) => {
    if (!token) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sendFriendRequest(identifier, token);
      await refreshUser();
      await loadData();
      await handleSearch();
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось отправить заявку.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIncomingRequest = async (requestId: number, action: 'accept' | 'reject') => {
    if (!token) {
      return;
    }

    try {
      if (action === 'accept') {
        await acceptFriendRequest(requestId, token);
        await refreshUser();
      } else {
        await rejectFriendRequest(requestId, token);
      }
      await loadData();
    } catch (caughtError) {
      const message = caughtError instanceof ApiError ? caughtError.message : 'Не удалось обновить заявку.';
      Alert.alert('Ошибка', message);
    }
  };

  const handleRemoveFriend = async (friendshipId: number) => {
    if (!token) {
      return;
    }

    try {
      await removeFriend(friendshipId, token);
      await refreshUser();
      await loadData();
      setSearchResults((currentValue) =>
        currentValue.map((item) =>
          item.relationship.friendshipId === friendshipId
            ? {
                ...item,
                relationship: {
                  friendshipId: null,
                  status: 'none',
                },
              }
            : item,
        ),
      );
    } catch (caughtError) {
        Alert.alert(
        'Ошибка',
        caughtError instanceof ApiError ? caughtError.message : 'Не удалось удалить друга.',
      );
    }
  };

  return (
    <AppShell
      title="Друзья"
      subtitle="Ищите по имени или email, открывайте публичные профили и собирайте свою компанию для просмотра.">
      <View style={[sharedStyles.card, styles.formCard]}>
        <Text style={styles.sectionTitle}>Найти пользователя</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="default"
          onChangeText={setQuery}
          placeholder="Имя пользователя или email"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={query}
        />
        <View style={styles.actionRow}>
          <Pressable onPress={() => void handleSearch()} style={[sharedStyles.primaryButton, styles.flexButton]}>
            {isSearching ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.primaryButtonText}>Поиск</Text>
          )}
          </Pressable>
          <Pressable
            onPress={() => void handleSendRequest(query.trim())}
            style={[sharedStyles.secondaryButton, styles.flexButton]}>
            {isSubmitting ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.secondaryButtonText}>Отправить заявку</Text>
          )}
        </Pressable>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {searchResults.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Результаты поиска</Text>
          {searchResults.map((item) => (
            <View key={item.id} style={[sharedStyles.card, styles.personCard]}>
              <Pressable
                onPress={() => router.push(`/users/${item.id}`)}
                style={styles.personHeader}>
                <AvatarBadge
                  avatarTheme={item.avatarTheme}
                  avatarUrl={item.avatarUrl}
                  label={item.name}
                  size={54}
                />
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>{item.name}</Text>
                  <Text style={sharedStyles.helperText}>
                    {item.username ? `@${item.username}` : item.email}
                  </Text>
                  <Text numberOfLines={2} style={sharedStyles.helperText}>
                    {item.bio || 'У этого профиля пока нет описания.'}
                  </Text>
                </View>
              </Pressable>

              {item.relationship.status === 'none' ? (
                <Pressable
                  onPress={() => void handleSendRequest(item.username ?? item.email)}
                  style={sharedStyles.primaryButton}>
                  <Text style={sharedStyles.primaryButtonText}>Добавить в друзья</Text>
                </Pressable>
              ) : null}

              {item.relationship.status === 'friend' && item.relationship.friendshipId ? (
                <Pressable
                  onPress={() => void handleRemoveFriend(item.relationship.friendshipId!)}
                  style={sharedStyles.secondaryButton}>
                  <Text style={sharedStyles.secondaryButtonText}>Удалить из друзей</Text>
                </Pressable>
              ) : null}

              {item.relationship.status === 'incoming_request' ? (
                <Text style={sharedStyles.helperText}>
                  Этот пользователь уже отправил вам заявку.
                </Text>
              ) : null}

              {item.relationship.status === 'outgoing_request' ? (
                <Text style={sharedStyles.helperText}>
                  Ваша заявка уже ожидает ответа.
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <View style={sharedStyles.card}>
          <ActivityIndicator color={AppColors.accent} />
        </View>
      ) : null}

      {!isLoading && friends.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Друзья</Text>
          {friends.map((friend) => (
            <View key={friend.id} style={[sharedStyles.card, styles.personCard]}>
              <Pressable
                onPress={() => router.push(`/users/${friend.id}`)}
                style={styles.personHeader}>
                <AvatarBadge
                  avatarTheme={friend.avatarTheme}
                  avatarUrl={friend.avatarUrl}
                  label={friend.name}
                  size={54}
                />
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>{friend.name}</Text>
                  <Text style={sharedStyles.helperText}>
                    {friend.username ? `@${friend.username}` : friend.email}
                  </Text>
                  <Text numberOfLines={2} style={sharedStyles.helperText}>
                    {friend.bio || 'У этого профиля пока нет описания.'}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => void handleRemoveFriend(friend.friendshipId)}
                style={sharedStyles.secondaryButton}>
                <Text style={sharedStyles.secondaryButtonText}>Удалить</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {!isLoading && requests.incoming.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Входящие заявки</Text>
          {requests.incoming.map((request) => (
            <View key={request.id} style={[sharedStyles.card, styles.personCard]}>
              <Pressable
                onPress={() => router.push(`/users/${request.user.id}`)}
                style={styles.personHeader}>
                <AvatarBadge
                  avatarTheme={request.user.avatarTheme}
                  avatarUrl={request.user.avatarUrl}
                  label={request.user.name}
                  size={54}
                />
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>{request.user.name}</Text>
                  <Text style={sharedStyles.helperText}>
                    {request.user.username ? `@${request.user.username}` : request.user.email}
                  </Text>
                  <Text style={styles.metaText}>Отправлено {formatShortDate(request.createdAt)}</Text>
                </View>
              </Pressable>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void handleIncomingRequest(request.id, 'accept')}
                  style={[sharedStyles.primaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.primaryButtonText}>Принять</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleIncomingRequest(request.id, 'reject')}
                  style={[sharedStyles.secondaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.secondaryButtonText}>Отклонить</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!isLoading && requests.outgoing.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Исходящие заявки</Text>
          {requests.outgoing.map((request) => (
            <View key={request.id} style={[sharedStyles.card, styles.personCard]}>
              <Pressable
                onPress={() => router.push(`/users/${request.user.id}`)}
                style={styles.personHeader}>
                <AvatarBadge
                  avatarTheme={request.user.avatarTheme}
                  avatarUrl={request.user.avatarUrl}
                  label={request.user.name}
                  size={54}
                />
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>{request.user.name}</Text>
                  <Text style={sharedStyles.helperText}>
                    {request.user.username ? `@${request.user.username}` : request.user.email}
                  </Text>
                  <Text style={styles.metaText}>Ожидает с {formatShortDate(request.createdAt)}</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {!isLoading &&
      !error &&
      friends.length === 0 &&
      requests.incoming.length === 0 &&
      requests.outgoing.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>
            Пока нет друзей или активных заявок. Найдите человека по имени или email и пригласите
            его в вашу компанию Cinema Notes.
          </Text>
        </View>
      ) : null}
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
    minWidth: 0,
  },
  formCard: {
    gap: 12,
  },
  metaText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  personCard: {
    gap: 10,
  },
  personCopy: {
    flex: 1,
    gap: 2,
  },
  personHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  personName: {
    color: AppColors.textPrimary,
    fontSize: 17,
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
});
