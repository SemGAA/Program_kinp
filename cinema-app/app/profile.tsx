import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { isLoading, refreshUser, signOut, user } = useAuth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AppShell title="Профиль" subtitle="Имя, email и счётчики активности вашего аккаунта.">
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Назад</Text>
      </Pressable>

      <View style={[sharedStyles.card, styles.profileCard]}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>{user?.name?.slice(0, 1).toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? 'Пользователь'}</Text>
        <Text style={sharedStyles.helperText}>{user?.email ?? 'Нет email'}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[sharedStyles.card, styles.statCard]}>
          <Text style={styles.statValue}>{user?.stats.notes ?? 0}</Text>
          <Text style={styles.statLabel}>заметок</Text>
        </View>
        <View style={[sharedStyles.card, styles.statCard]}>
          <Text style={styles.statValue}>{user?.stats.friends ?? 0}</Text>
          <Text style={styles.statLabel}>друзей</Text>
        </View>
      </View>

      <View style={[sharedStyles.card, styles.actionsCard]}>
        <Pressable onPress={() => void handleRefresh()} style={sharedStyles.secondaryButton}>
          {isRefreshing || isLoading ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.secondaryButtonText}>Обновить профиль</Text>
          )}
        </Pressable>
        <Pressable onPress={() => void signOut()} style={sharedStyles.primaryButton}>
          <Text style={sharedStyles.primaryButtonText}>Выйти</Text>
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actionsCard: {
    gap: 12,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    width: 84,
  },
  avatarText: {
    color: AppColors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
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
  name: {
    color: AppColors.textPrimary,
    fontSize: 26,
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
    fontSize: 28,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
