import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import {
  acceptFriendRequest,
  ApiError,
  getUserProfile,
  rejectFriendRequest,
  removeFriend,
  sendFriendRequest,
} from '@/lib/api';
import type { UserProfile } from '@/types/app';

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refreshUser, token, user } = useAuth();
  const userId = Number(id);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const loadProfile = useCallback(async () => {
    if (!token || !Number.isFinite(userId)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const payload = await getUserProfile(userId, token);
      setProfile(payload);
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить профиль.');
    } finally {
      setIsLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleAction = async (action: 'add' | 'accept' | 'reject' | 'remove') => {
    if (!token || !profile) {
      return;
    }

    setIsMutating(true);
    setError(null);

    try {
      if (action === 'add') {
        await sendFriendRequest(profile.username ?? profile.email, token);
      }

      if (action === 'accept' && profile.relationship.friendshipId) {
        await acceptFriendRequest(profile.relationship.friendshipId, token);
      }

      if (action === 'reject' && profile.relationship.friendshipId) {
        await rejectFriendRequest(profile.relationship.friendshipId, token);
      }

      if (action === 'remove' && profile.relationship.friendshipId) {
        await removeFriend(profile.relationship.friendshipId, token);
      }

      await refreshUser();
      await loadProfile();
    } catch (caughtError) {
        Alert.alert(
        'Ошибка',
        caughtError instanceof ApiError ? caughtError.message : 'Не удалось обновить состояние дружбы.',
      );
    } finally {
      setIsMutating(false);
    }
  };

  const actionBlock = () => {
    if (!profile || Number(profile.id) === Number(user?.id)) {
      return null;
    }

    switch (profile.relationship.status) {
      case 'friend':
        return (
          <Pressable
            onPress={() => void handleAction('remove')}
            style={sharedStyles.secondaryButton}>
            <Text style={sharedStyles.secondaryButtonText}>Удалить из друзей</Text>
          </Pressable>
        );
      case 'incoming_request':
        return (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => void handleAction('accept')}
              style={[sharedStyles.primaryButton, styles.flexButton]}>
              <Text style={sharedStyles.primaryButtonText}>Принять</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleAction('reject')}
              style={[sharedStyles.secondaryButton, styles.flexButton]}>
              <Text style={sharedStyles.secondaryButtonText}>Отклонить</Text>
            </Pressable>
          </View>
        );
      case 'outgoing_request':
        return (
          <Pressable
            onPress={() => void handleAction('remove')}
            style={sharedStyles.secondaryButton}>
            <Text style={sharedStyles.secondaryButtonText}>Отменить заявку</Text>
          </Pressable>
        );
      case 'none':
        return (
          <Pressable onPress={() => void handleAction('add')} style={sharedStyles.primaryButton}>
            <Text style={sharedStyles.primaryButtonText}>Добавить в друзья</Text>
          </Pressable>
        );
      default:
        return null;
    }
  };

  return (
    <AppShell title={profile?.name ?? 'Профиль пользователя'} subtitle="Публичная карточка Cinema Notes.">
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Назад</Text>
      </Pressable>

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

      {profile ? (
        <>
          <View style={[sharedStyles.card, styles.profileCard]}>
            <AvatarBadge
              avatarTheme={profile.avatarTheme}
              avatarUrl={profile.avatarUrl}
              label={profile.name}
              size={96}
            />
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={sharedStyles.helperText}>
              {profile.username ? `@${profile.username}` : 'Имя пользователя пока не указано'}
            </Text>
            <Text style={sharedStyles.helperText}>
              {profile.bio || 'У этого профиля пока нет описания.'}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={[sharedStyles.card, styles.statCard]}>
              <Text style={styles.statValue}>{profile.stats.notes}</Text>
              <Text style={styles.statLabel}>заметки</Text>
            </View>
            <View style={[sharedStyles.card, styles.statCard]}>
              <Text style={styles.statValue}>{profile.stats.friends}</Text>
              <Text style={styles.statLabel}>друзья</Text>
            </View>
            <View style={[sharedStyles.card, styles.statCard]}>
              <Text style={styles.statValue}>{profile.stats.rooms}</Text>
              <Text style={styles.statLabel}>комнаты</Text>
            </View>
          </View>

          <View style={[sharedStyles.card, styles.actionsCard]}>
            {isMutating ? <ActivityIndicator color={AppColors.accent} /> : actionBlock()}
          </View>
        </>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionsCard: {
    gap: 12,
  },
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
  flexButton: {
    flex: 1,
  },
  name: {
    color: AppColors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  profileCard: {
    alignItems: 'center',
    gap: 10,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  statLabel: {
    color: AppColors.textSecondary,
    fontSize: 13,
  },
  statValue: {
    color: AppColors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
