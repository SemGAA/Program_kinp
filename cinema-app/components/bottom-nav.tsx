import { Compass, House, NotebookPen, PlaySquare, Users, type LucideIcon } from 'lucide-react-native';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppColors } from '@/constants/theme';

type NavItem = {
  href: '/' | '/search' | '/watch' | '/notes' | '/friends';
  icon: LucideIcon;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/', icon: House, label: 'Главная' },
  { href: '/search', icon: Compass, label: 'Поиск' },
  { href: '/watch', icon: PlaySquare, label: 'Комнаты' },
  { href: '/notes', icon: NotebookPen, label: 'Заметки' },
  { href: '/friends', icon: Users, label: 'Друзья' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={styles.wrapper}>
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Pressable
            key={href}
            onPress={() => router.replace(href)}
            style={[styles.item, isActive && styles.itemActive]}>
            <Icon color={isActive ? AppColors.textPrimary : AppColors.textSecondary} size={18} />
            <Text style={[styles.label, isActive && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#10192B',
    borderTopColor: AppColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingBottom: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  item: {
    alignItems: 'center',
    borderRadius: 16,
    flex: 1,
    gap: 6,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: AppColors.cardMuted,
  },
  label: {
    color: AppColors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  labelActive: {
    color: AppColors.textPrimary,
  },
});
