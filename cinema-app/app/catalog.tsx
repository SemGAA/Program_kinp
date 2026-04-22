import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';

const CATALOG_SECTIONS = [
  {
    description: 'Поиск по Shikimori и вашей Jellyfin-медиатеке. Если тайтл есть в Jellyfin, он откроется сразу.',
    label: 'Аниме',
    query: 'аниме',
  },
  {
    description: 'Карточки, постеры, годы и заметки по TMDB. Встроенный просмотр включается при наличии Jellyfin.',
    label: 'Фильмы',
    query: 'фильм',
  },
  {
    description: 'Сериалы и сезоны из каталога. Для просмотра серий подключите свою библиотеку Jellyfin.',
    label: 'Сериалы',
    query: 'сериал',
  },
  {
    description: 'Видео из Internet Archive с открытыми лицензиями, которые можно запускать во встроенном плеере.',
    label: 'Открытые видео',
    query: 'public domain movie',
  },
];

const QUICK_QUERIES = ['Наруто', 'Ван Пис', 'комедия', 'фантастика', 'драма', 'короткометражка'];

export default function CatalogScreen() {
  const router = useRouter();

  const openSearch = (query: string) => {
    router.push({
      pathname: '/search',
      params: { initialQuery: query },
    });
  };

  return (
    <AppShell
      title="Каталог"
      subtitle="Разделы для быстрого старта: выбираете направление, приложение сразу открывает живой поиск и показывает доступные источники.">
      <View style={styles.grid}>
        {CATALOG_SECTIONS.map((section) => (
          <Pressable
            key={section.label}
            onPress={() => openSearch(section.query)}
            style={[sharedStyles.card, styles.sectionCard]}>
            <Text style={styles.sectionTitle}>{section.label}</Text>
            <Text style={sharedStyles.helperText}>{section.description}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[sharedStyles.card, styles.quickCard]}>
        <Text style={styles.sectionTitle}>Быстрые запросы</Text>
        <View style={styles.chipRow}>
          {QUICK_QUERIES.map((query) => (
            <Pressable key={query} onPress={() => openSearch(query)} style={styles.chip}>
              <Text style={styles.chipText}>{query}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={[sharedStyles.card, styles.jellyfinCard]}>
        <Text style={styles.sectionTitle}>Свой медиасервер</Text>
        <Text style={sharedStyles.helperText}>
          Чтобы смотреть коммерческие фильмы, сериалы и аниме без серых схем, подключите Jellyfin с вашей личной библиотекой. Тогда поиск будет находить тайтл и запускать первую серию или фильм сразу в комнате.
        </Text>
        <Pressable onPress={() => router.push('/media-server')} style={sharedStyles.primaryButton}>
          <Text style={sharedStyles.primaryButtonText}>Подключить Jellyfin</Text>
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipText: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  grid: {
    gap: 12,
  },
  jellyfinCard: {
    gap: 14,
  },
  quickCard: {
    gap: 12,
  },
  sectionCard: {
    gap: 10,
  },
  sectionTitle: {
    color: AppColors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
});
