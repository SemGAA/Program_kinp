import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  acceptFriendRequest,
  ApiError,
  getFriendRequests,
  getFriends,
  rejectFriendRequest,
  sendFriendRequest,
} from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import type { Friend, FriendRequestsPayload } from '@/types/app';

export default function FriendsScreen() {
  const { refreshUser, token } = useAuth();
  const [email, setEmail] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequestsPayload>({ incoming: [], outgoing: [] });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [friendsPayload, requestsPayload] = await Promise.all([getFriends(token), getFriendRequests(token)]);
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

  const handleSendRequest = async () => {
    if (!token) {
      return;
    }

    if (!email.trim()) {
      setError('Введите email пользователя.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sendFriendRequest(email.trim(), token);
      setEmail('');
      await loadData();
    } catch (caughtError) {
      const message = caughtError instanceof ApiError ? caughtError.message : 'Не удалось отправить заявку.';
      setError(message);
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

  return (
    <AppShell
      title="Друзья"
      subtitle="Добавляйте друзей по email. После подтверждения можно делиться заметками и смотреть вместе.">
      <View style={[sharedStyles.card, styles.formCard]}>
        <Text style={styles.sectionTitle}>Пригласить по email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="friend@example.com"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={email}
        />
        <Pressable onPress={() => void handleSendRequest()} style={sharedStyles.primaryButton}>
          {isSubmitting ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.primaryButtonText}>Отправить заявку</Text>
          )}
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

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
              <Text style={styles.personName}>{friend.name}</Text>
              <Text style={sharedStyles.helperText}>{friend.email}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {!isLoading && requests.incoming.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Входящие заявки</Text>
          {requests.incoming.map((request) => (
            <View key={request.id} style={[sharedStyles.card, styles.personCard]}>
              <Text style={styles.personName}>{request.user.name}</Text>
              <Text style={sharedStyles.helperText}>{request.user.email}</Text>
              <Text style={styles.metaText}>Отправлена {formatShortDate(request.createdAt)}</Text>
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
              <Text style={styles.personName}>{request.user.name}</Text>
              <Text style={sharedStyles.helperText}>{request.user.email}</Text>
              <Text style={styles.metaText}>Ожидает ответа с {formatShortDate(request.createdAt)}</Text>
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
            Пока нет друзей и активных заявок. Добавьте пользователя по email, чтобы начать совместные
            просмотры и обмен заметками.
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
    gap: 8,
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
