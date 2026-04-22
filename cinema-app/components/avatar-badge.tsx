import { Image, StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/constants/theme';

type AvatarBadgeProps = {
  avatarTheme?: string | null;
  avatarUrl?: string | null;
  label: string;
  size?: number;
};

const THEME_MAP: Record<string, { background: string; foreground: string }> = {
  ember: { background: '#4A231B', foreground: '#FFB09E' },
  midnight: { background: '#182236', foreground: '#A3C8FF' },
  mint: { background: '#17322B', foreground: '#9DE6C7' },
  ocean: { background: '#113451', foreground: '#8EDCFF' },
  sunset: { background: '#4A1F25', foreground: '#FFB39F' },
  violet: { background: '#34204D', foreground: '#D2B7FF' },
};

export function AvatarBadge({
  avatarTheme,
  avatarUrl,
  label,
  size = 56,
}: AvatarBadgeProps) {
  const theme = THEME_MAP[avatarTheme || 'sunset'] || THEME_MAP.sunset;
  const initials = label.trim().slice(0, 1).toUpperCase() || '?';

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.image,
          {
            borderRadius: size / 2,
            height: size,
            width: size,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          backgroundColor: theme.background,
          borderRadius: size / 2,
          height: size,
          width: size,
        },
      ]}>
      <Text
        style={[
          styles.initials,
          {
            color: theme.foreground,
            fontSize: Math.max(16, Math.round(size * 0.34)),
          },
        ]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    borderColor: AppColors.border,
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderWidth: 1,
  },
  initials: {
    fontWeight: '800',
  },
});
