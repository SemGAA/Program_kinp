import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError, createWatchRoom, searchMovies } from '@/lib/api';
import { EXTERNAL_STREAM_ENDPOINT, resolveAutoVideoMatch } from '@/lib/auto-video';
import { resolveJellyfinPlaybackForResult } from '@/lib/jellyfin';
import type { MovieSearchResult } from '@/types/app';

function buildMovieKey(movie: MovieSearchResult) {
  const sourceKey = movie.sourceProvider || movie.sourceKind || 'catalog';
  return movie.videoUrl ? `video:${movie.videoUrl}` : `${sourceKey}:${movie.mediaType}:${movie.id}`;
}

function buildMovieMeta(movie: MovieSearchResult) {
  const parts = [movie.mediaLabel];

  parts.push(movie.releaseYear ? String(movie.releaseYear) : 'год не указан');

  if (movie.seasonCount) {
    parts.push(`сезонов ${movie.seasonCount}`);
  }

  if (movie.episodeCount) {
    parts.push(`серий ${movie.episodeCount}`);
  }

  if (movie.rating) {
    parts.push(`рейтинг ${movie.rating.toFixed(1)}`);
  }

  if (movie.sourceLabel) {
    parts.push(movie.sourceLabel);
  }

  return parts.join(' · ');
}

function getSourceBadge(movie: MovieSearchResult) {
  if (movie.sourceKind === 'jellyfin') {
    return 'Jellyfin · встроенный просмотр';
  }

  if (movie.sourceKind === 'internet_archive') {
    return 'Internet Archive · встроенный просмотр';
  }

  if (movie.sourceKind === 'youtube') {
    return 'YouTube · внешний источник';
  }

  if (movie.sourceKind === 'direct') {
    return 'Прямая ссылка · встроенный просмотр';
  }

  if (movie.sourceKind === 'external' && movie.sourceLabel?.includes('Заблокировано')) {
    return 'Заблокировано · источник не подключён';
  }

  if (movie.sourceKind === 'shikimori') {
    return 'Аниме · нужен Jellyfin для видео';
  }

  return 'Каталог · карточка и заметки';
}

function readRouteParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function canTryBuiltInPlayback(movie: MovieSearchResult) {
  if (movie.sourceKind === 'youtube' || movie.sourceKind === 'external') {
    return false;
  }

  return Boolean(movie.videoUrl) || movie.sourceKind === 'jellyfin';
}

export default function SearchScreen() {
  const router = useRouter();
  const { initialQuery } = useLocalSearchParams<{ initialQuery?: string }>();
  const { token } = useAuth();
  const lastInitialQueryRef = useRef<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [openingKey, setOpeningKey] = useState<string | null>(null);

  useEffect(() => {
    const nextQuery = readRouteParam(initialQuery)?.trim();
    if (nextQuery && lastInitialQueryRef.current !== nextQuery) {
      lastInitialQueryRef.current = nextQuery;
      setQuery(nextQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setHasSearched(false);
      setError(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      setHasSearched(true);
      setIsLoading(true);
      setError(null);

      void searchMovies(trimmedQuery, token)
        .then((media) => {
          if (active) {
            setResults(media);
          }
        })
        .catch((caughtError) => {
          if (!active) {
            return;
          }

          setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось выполнить поиск.');
          setResults([]);
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, token]);

  const emptyState = useMemo(() => {
    if (!hasSearched) {
      return 'Начните вводить название. Варианты появятся автоматически, без кнопки поиска.';
    }

    if (!error && results.length === 0) {
      return 'Ничего не найдено. Попробуйте другое написание, английское название или более короткий запрос.';
    }

    return null;
  }, [error, hasSearched, results.length]);

  const handleOpenRoom = async (movie: MovieSearchResult) => {
    if (!token) {
      return;
    }

    const movieKey = buildMovieKey(movie);
    setOpeningKey(movieKey);
    setError(null);

    try {
      if (movie.sourceKind === 'youtube' || movie.sourceKind === 'external') {
        Alert.alert(
          'Внешний источник',
          'Это не встроенный фильм или аниме. Такой результат можно открыть отдельно, но Cinema Notes не будет показывать его как полноценный встроенный просмотр.',
        );
        return;
      }

      const jellyfinPlayback =
        movie.sourceKind === 'jellyfin'
          ? await resolveJellyfinPlaybackForResult(movie).catch(() => null)
          : null;

      const autoMatch =
        !movie.videoUrl && !jellyfinPlayback
          ? await resolveAutoVideoMatch({
              mediaType: movie.mediaType,
              releaseYear: movie.releaseYear,
              shikimoriId: movie.shikimoriId,
              title: movie.title,
              tmdbId: movie.sourceKind === 'catalog' ? movie.id : null,
            })
          : null;

      const resolvedVideoUrl =
        movie.videoUrl ||
        jellyfinPlayback?.streamUrl ||
        autoMatch?.streamUrl ||
        null;

      if (!resolvedVideoUrl) {
        Alert.alert(
          'Источник не найден',
          EXTERNAL_STREAM_ENDPOINT
            ? 'Карточка найдена, но ни Jellyfin, ни настроенный внешний провайдер пока не вернули поток для встроенного просмотра.'
            : 'Карточка найдена, но легальный поток для встроенного просмотра не подключён. Добавьте этот тайтл в свою Jellyfin-медиатеку или настройте внешний провайдер.',
        );
        handleOpenCard(movie);
        return;
      }

      const room = await createWatchRoom(
        {
          media_type: movie.mediaType,
          movie_title: jellyfinPlayback?.title ?? autoMatch?.title ?? movie.title,
          poster_path: movie.posterPath,
          release_year: movie.releaseYear,
          video_url: resolvedVideoUrl,
          ...(movie.sourceKind === 'catalog' ? { tmdb_id: movie.id } : {}),
        },
        token,
      );

      router.push({
        pathname: '/watch/[code]',
        params: { code: room.code },
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : 'Не удалось открыть комнату. Попробуйте ещё раз.',
      );
    } finally {
      setOpeningKey(null);
    }
  };

  const handleOpenCard = (movie: MovieSearchResult) => {
    if (canTryBuiltInPlayback(movie)) {
      void handleOpenRoom(movie);
      return;
    }

    if (movie.sourceKind && movie.sourceKind !== 'catalog') {
      Alert.alert(
        movie.title,
        movie.overview ||
          'Это карточка каталога. Для просмотра подключите Jellyfin или выберите результат с готовым встроенным источником.',
      );
      return;
    }

    router.push({
      pathname: '/movie/[tmdbId]',
      params: {
        initialMediaLabel: movie.mediaLabel,
        initialOverview: movie.overview,
        initialPosterPath: movie.posterPath ?? '',
        initialPosterUrl: movie.posterUrl ?? '',
        initialRating: movie.rating === null ? '' : String(movie.rating),
        initialReleaseYear: movie.releaseYear === null ? '' : String(movie.releaseYear),
        initialTitle: movie.title,
        initialVideoUrl: movie.videoUrl ?? '',
        mediaType: movie.mediaType,
        tmdbId: String(movie.id),
      },
    });
  };

  return (
    <AppShell
      title="Поиск"
      subtitle="Вводите название фильма, сериала, аниме или ссылку. Если у результата есть легальный поток, комната откроется сразу со встроенным плеером.">
      <View style={[sharedStyles.card, styles.searchCard]}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Наруто, фильм, сериал, аниме или ссылка"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={query}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <Text style={sharedStyles.helperText}>
          Легально встроенно запускаются открытые видео из Internet Archive, прямые видео, ваша медиатека Jellyfin и настроенный внешний провайдер. По TMDB/Shikimori показываются карточки, сезоны и данные, а поток подбирается автоматически.
        </Text>
      </View>

      {isLoading ? (
        <View style={sharedStyles.card}>
          <ActivityIndicator color={AppColors.accent} />
        </View>
      ) : null}

      {results.map((movie) => {
        const movieKey = buildMovieKey(movie);
        const isOpening = openingKey === movieKey;
        const canWatch = canTryBuiltInPlayback(movie);

        return (
          <View key={movieKey} style={[sharedStyles.card, styles.movieCard]}>
            <Pressable
              onPress={() => (canWatch ? void handleOpenRoom(movie) : handleOpenCard(movie))}
              style={styles.tapArea}>
              {movie.posterUrl ? <Image source={{ uri: movie.posterUrl }} style={styles.poster} /> : null}
              <View style={styles.movieCopy}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{getSourceBadge(movie)}</Text>
                </View>
                <Text style={styles.movieTitle}>{movie.title}</Text>
                <Text style={sharedStyles.helperText}>{buildMovieMeta(movie)}</Text>
                <Text numberOfLines={4} style={sharedStyles.helperText}>
                  {movie.overview || 'Описание пока недоступно.'}
                </Text>
              </View>
            </Pressable>

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => (canWatch ? void handleOpenRoom(movie) : handleOpenCard(movie))}
                style={[sharedStyles.primaryButton, styles.flexButton]}>
                {isOpening ? (
                  <ActivityIndicator color={AppColors.textPrimary} />
                ) : (
                  <Text style={sharedStyles.primaryButtonText}>{canWatch ? 'Смотреть' : 'Карточка'}</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => handleOpenCard(movie)}
                style={[sharedStyles.secondaryButton, styles.flexButton]}>
                <Text style={sharedStyles.secondaryButtonText}>
                  {movie.sourceKind === 'jellyfin' ? 'Комната' : 'Заметки'}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      {emptyState ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>{emptyState}</Text>
        </View>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: AppColors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  flexButton: {
    flex: 1,
  },
  movieCard: {
    gap: 14,
  },
  movieCopy: {
    flex: 1,
    gap: 8,
  },
  movieTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  poster: {
    borderRadius: 18,
    height: 150,
    width: 104,
  },
  searchCard: {
    gap: 12,
  },
  tapArea: {
    flexDirection: 'row',
    gap: 14,
  },
});
