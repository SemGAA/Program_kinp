import * as ImagePicker from 'expo-image-picker';
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

import { AvatarBadge } from '@/components/avatar-badge';
import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError, updateProfile } from '@/lib/api';

const AVATAR_THEMES = ['sunset', 'ocean', 'violet', 'mint', 'ember', 'midnight'] as const;
const MAX_LOCAL_AVATAR_LENGTH = 1050000;

export default function ProfileScreen() {
  const router = useRouter();
  const { isLoading, refreshUser, signOut, token, user } = useAuth();
  const [avatarTheme, setAvatarTheme] = useState(user?.avatarTheme ?? 'sunset');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [username, setUsername] = useState(user?.username ?? '');

  useEffect(() => {
    setAvatarTheme(user?.avatarTheme ?? 'sunset');
    setAvatarUrl(user?.avatarUrl ?? null);
    setBio(user?.bio ?? '');
    setName(user?.name ?? '');
    setUsername(user?.username ?? '');
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Нужно разрешение', 'Разрешите доступ к галерее, чтобы выбрать аватар.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.28,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64 || !asset.mimeType) {
      Alert.alert('Не удалось загрузить', 'Не получилось подготовить выбранное изображение.');
      return;
    }

    const nextAvatar = `data:${asset.mimeType};base64,${asset.base64}`;
    if (nextAvatar.length > MAX_LOCAL_AVATAR_LENGTH) {
      Alert.alert(
        'Аватар слишком большой',
        'Выберите изображение поменьше или обрежьте его сильнее. Так профиль сохранится без ошибок.',
      );
      return;
    }

    setError(null);
    setAvatarUrl(nextAvatar);
  };

  const handleSaveProfile = async () => {
    if (!token) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await updateProfile(
        {
          avatar_theme: avatarTheme,
          avatar_url: avatarUrl,
          bio,
          name,
          username,
        },
        token,
      );
      await refreshUser();
      Alert.alert('Сохранено', 'Профиль обновлён.');
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось обновить профиль.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      title="Профиль"
      subtitle="Аватар, никнейм, имя и описание профиля. Эти данные видны друзьям и в публичной карточке.">
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Назад</Text>
      </Pressable>

      <View style={[sharedStyles.card, styles.profileCard]}>
        <AvatarBadge
          avatarTheme={avatarTheme}
          avatarUrl={avatarUrl}
          label={name || user?.name || 'U'}
          size={92}
        />
        <View style={styles.profileIdentity}>
          <Text style={styles.name}>{name || user?.name || 'Пользователь'}</Text>
          <Text style={sharedStyles.helperText}>
            {username ? `@${username}` : 'Никнейм появится после сохранения.'}
          </Text>
          <Text style={sharedStyles.helperText}>{user?.email ?? 'Email не указан'}</Text>
        </View>
        <View style={styles.avatarActions}>
          <Pressable onPress={() => void handlePickAvatar()} style={sharedStyles.secondaryButton}>
            <Text style={sharedStyles.secondaryButtonText}>Выбрать аватар</Text>
          </Pressable>
          {avatarUrl ? (
            <Pressable
              onPress={() => setAvatarUrl(null)}
              style={[sharedStyles.secondaryButton, styles.compactButton]}>
              <Text style={sharedStyles.secondaryButtonText}>Сбросить</Text>
            </Pressable>
          ) : null}
        </View>
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

      <View style={[sharedStyles.card, styles.editorCard]}>
        <Text style={styles.sectionTitle}>Настройки профиля</Text>

        <TextInput
          onChangeText={setName}
          placeholder="Отображаемое имя"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={name}
        />

        <TextInput
          autoCapitalize="none"
          onChangeText={setUsername}
          placeholder="Никнейм, например cinema_friend"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={username}
        />

        <TextInput
          multiline
          onChangeText={setBio}
          placeholder="Расскажите немного о себе и о том, что любите смотреть."
          placeholderTextColor={AppColors.textSecondary}
          style={[sharedStyles.input, styles.bioInput]}
          textAlignVertical="top"
          value={bio}
        />

        <View style={styles.themeRow}>
          {AVATAR_THEMES.map((theme) => (
            <Pressable
              key={theme}
              onPress={() => setAvatarTheme(theme)}
              style={[styles.themeChip, avatarTheme === theme && styles.themeChipActive]}>
              <Text style={styles.themeChipText}>{theme}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Pressable onPress={() => void handleSaveProfile()} style={sharedStyles.primaryButton}>
          {isSaving ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.primaryButtonText}>Сохранить профиль</Text>
          )}
        </Pressable>
      </View>

      <View style={[sharedStyles.card, styles.actionsCard]}>
        <Pressable onPress={() => router.push('/media-server')} style={sharedStyles.secondaryButton}>
          <Text style={sharedStyles.secondaryButtonText}>Подключить Jellyfin</Text>
        </Pressable>
        <Pressable
          onPress={() => user && router.push(`/users/${user.id}`)}
          style={sharedStyles.secondaryButton}>
          <Text style={sharedStyles.secondaryButtonText}>Открыть публичный профиль</Text>
        </Pressable>
        <Pressable onPress={() => void handleRefresh()} style={sharedStyles.secondaryButton}>
          {isRefreshing || isLoading ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.secondaryButtonText}>Обновить данные</Text>
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
  avatarActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
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
  bioInput: {
    minHeight: 120,
  },
  compactButton: {
    minWidth: 110,
  },
  editorCard: {
    gap: 12,
  },
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  name: {
    color: AppColors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  profileCard: {
    alignItems: 'center',
    gap: 14,
  },
  profileIdentity: {
    alignItems: 'center',
    gap: 4,
  },
  sectionTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
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
    fontSize: 26,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  themeChip: {
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  themeChipActive: {
    borderColor: AppColors.accent,
  },
  themeChipText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
