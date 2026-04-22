import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarBadge } from '@/components/avatar-badge';
import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <AppShell
      title="Cinema Notes"
      subtitle="Находите фильмы и аниме, создавайте комнату за секунды, приглашайте друзей и переписывайтесь рядом с видео.">
      <View style={[sharedStyles.card, styles.heroCard]}>
        <View style={styles.heroHeader}>
          <View style={styles.heroIdentity}>
            <AvatarBadge
              avatarTheme={user?.avatarTheme}
              avatarUrl={user?.avatarUrl}
              label={user?.name ?? 'U'}
              size={56}
            />
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Cinema Notes</Text>
              <Text style={styles.heroTitle}>
                {user ? `Привет, ${user.name}` : 'Добро пожаловать'}
              </Text>
              <Text style={sharedStyles.helperText}>
                {user?.username
                  ? `@${user.username}`
                  : 'Публичный профиль можно настроить в любой момент.'}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/profile')} style={styles.profileButton}>
            <Text style={styles.profileButtonText}>Профиль</Text>
          </Pressable>
        </View>
        <Text style={sharedStyles.helperText}>
          Самый быстрый путь: откройте поиск, выберите фильм или сериал и создайте комнату одним
          нажатием.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[sharedStyles.card, styles.statCard]}>
          <Text style={styles.statValue}>{user?.stats.notes ?? 0}</Text>
          <Text style={styles.statLabel}>заметки</Text>
        </View>
        <View style={[sharedStyles.card, styles.statCard]}>
          <Text style={styles.statValue}>{user?.stats.friends ?? 0}</Text>
          <Text style={styles.statLabel}>друзья</Text>
        </View>
        <View style={[sharedStyles.card, styles.statCard]}>
          <Text style={styles.statValue}>{user?.stats.rooms ?? 0}</Text>
          <Text style={styles.statLabel}>комнаты</Text>
        </View>
      </View>

      <View style={styles.actionGrid}>
        <Pressable onPress={() => router.push('/catalog')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Каталог</Text>
          <Text style={sharedStyles.helperText}>
            Быстрые разделы: аниме, фильмы, сериалы, открытые видео и подключение Jellyfin.
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/search')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Поиск</Text>
          <Text style={sharedStyles.helperText}>
            Вводите название, варианты появляются автоматически без кнопки поиска.
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/watch')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Мои комнаты</Text>
          <Text style={sharedStyles.helperText}>
            Здесь собраны активные комнаты, приглашения, коды и быстрые входы.
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/friends')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Друзья и профили</Text>
          <Text style={sharedStyles.helperText}>
            Ищите людей, открывайте профили и собирайте свою компанию для совместного просмотра.
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/notes')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Заметки о просмотре</Text>
          <Text style={sharedStyles.helperText}>
            Сохраняйте впечатления, делитесь заметками и держите любимые фильмы под рукой.
          </Text>
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    gap: 12,
  },
  actionGrid: {
    gap: 14,
  },
  actionTitle: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  eyebrow: {
    color: AppColors.accentSecondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroCard: {
    gap: 14,
    paddingVertical: 22,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroHeader: {
    gap: 12,
  },
  heroIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  heroTitle: {
    color: AppColors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  profileButton: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileButtonText: {
    color: AppColors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
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
    gap: 10,
  },
});
