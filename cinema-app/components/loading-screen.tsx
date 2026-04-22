import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/constants/theme';

export function LoadingScreen({ label = 'Загрузка...' }: { label?: string }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={AppColors.accent} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: AppColors.background,
    flex: 1,
    gap: 16,
    justifyContent: 'center',
    padding: 24,
  },
  label: {
    color: AppColors.textSecondary,
    fontSize: 15,
  },
});
