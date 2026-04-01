import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <AppShell
      title="Cinema Notes"
      subtitle="Поиск фильмов, сериалов, аниме и дорам, совместный просмотр по комнате и заметки прямо во время сеанса.">
      <View style={[sharedStyles.card, styles.heroCard]}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>MVP</Text>
            <Text style={styles.heroTitle}>{user ? `Привет, ${user.name}` : 'Привет'}</Text>
          </View>
          <Pressable onPress={() => router.push('/profile')} style={styles.profileButton}>
            <Text style={styles.profileButtonText}>Профиль</Text>
          </Pressable>
        </View>
        <Text style={sharedStyles.helperText}>
          Найдите фильм в каталоге, откройте карточку, создайте комнату просмотра и отправьте другу код
          комнаты. Для синхронного просмотра нужен прямой видео-URL, например mp4 или m3u8.
        </Text>
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

      <View style={styles.actionGrid}>
        <Pressable onPress={() => router.push('/search')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Найти фильм</Text>
          <Text style={sharedStyles.helperText}>
            Поиск по каталогу фильмов, сериалов, дорам, аниме и мультсериалов, заметки и создание комнаты просмотра из карточки.
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/watch')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Комнаты просмотра</Text>
          <Text style={sharedStyles.helperText}>
            Войти по коду, открыть уже созданную комнату или быстро поднять демо-комнату для проверки.
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/notes')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Мои заметки</Text>
          <Text style={sharedStyles.helperText}>
            Сохраняйте впечатления о фильмах и делитесь ими с друзьями в приложении.
          </Text>
        </Pressable>
        <Pressable onPress={() => router.push('/friends')} style={[sharedStyles.card, styles.actionCard]}>
          <Text style={styles.actionTitle}>Друзья</Text>
          <Text style={sharedStyles.helperText}>
            Добавляйте друзей по email и используйте их для совместных просмотров и обмена заметками.
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
    gap: 6,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroTitle: {
    color: AppColors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  profileButton: {
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
    gap: 12,
  },
});
