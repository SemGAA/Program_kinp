import { PropsWithChildren, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/bottom-nav';
import { AppColors } from '@/constants/theme';

type AppShellProps = PropsWithChildren<{
  footer?: ReactNode;
  subtitle?: string;
  title: string;
}>;

export function AppShell({ children, footer, subtitle, title }: AppShellProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {footer === undefined ? <BottomNav /> : footer}
    </SafeAreaView>
  );
}

export const sharedStyles = StyleSheet.create({
  card: {
    backgroundColor: AppColors.card,
    borderColor: AppColors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  cardTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.cardMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: AppColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  helperText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    backgroundColor: '#0D1627',
    borderColor: AppColors.border,
    borderRadius: 18,
    borderWidth: 1,
    color: AppColors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: AppColors.accent,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: AppColors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});

const styles = StyleSheet.create({
  content: {
    gap: 18,
    paddingBottom: 42,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  header: {
    gap: 8,
  },
  safeArea: {
    backgroundColor: AppColors.background,
    flex: 1,
  },
  subtitle: {
    color: AppColors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  title: {
    color: AppColors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
});
