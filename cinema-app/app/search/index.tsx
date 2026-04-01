import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { ApiError, searchMovies } from '@/lib/api';
import type { MovieSearchResult } from '@/types/app';

export default function SearchScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async () => {
    if (!token) {
      return;
    }

    if (query.trim().length < 2) {
      setError('Введите минимум 2 символа.');
      return;
    }

    setError(null);
    setHasSearched(true);
    setIsLoading(true);

    try {
      const movies = await searchMovies(query.trim(), token);
      setResults(movies);
    } catch (caughtError) {
      const message = caughtError instanceof ApiError ? caughtError.message : 'Не удалось выполнить поиск.';
      setError(message);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppShell
      title="Поиск"
      subtitle="Ищите фильмы, сериалы, дорамы, аниме и мультсериалы. Из карточки можно сохранить заметку и открыть комнату просмотра.">
      <View style={[sharedStyles.card, styles.searchCard]}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          placeholder="Название фильма"
          placeholderTextColor={AppColors.textSecondary}
          style={sharedStyles.input}
          value={query}
        />
        <Pressable onPress={() => void handleSearch()} style={sharedStyles.primaryButton}>
          {isLoading ? (
            <ActivityIndicator color={AppColors.textPrimary} />
          ) : (
            <Text style={sharedStyles.primaryButtonText}>Найти фильм</Text>
          )}
        </Pressable>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {results.map((movie) => (
        <Pressable
          key={movie.id}
          onPress={() =>
            router.push({
              pathname: '/movie/[tmdbId]',
              params: {
                tmdbId: String(movie.id),
                mediaType: movie.mediaType,
              },
            })
          }
          style={[sharedStyles.card, styles.movieCard]}>
          {movie.posterUrl ? <Image source={{ uri: movie.posterUrl }} style={styles.poster} /> : null}
          <View style={styles.movieCopy}>
            <Text style={styles.movieTitle}>{movie.title}</Text>
            <Text style={sharedStyles.helperText}>
              {movie.mediaLabel}
              {movie.releaseYear ? ` • ${movie.releaseYear}` : ' • год не указан'}
              {movie.rating ? ` • рейтинг ${movie.rating.toFixed(1)}` : ''}
            </Text>
            <Text numberOfLines={4} style={sharedStyles.helperText}>
              {movie.overview || 'Описание пока не доступно.'}
            </Text>
          </View>
        </Pressable>
      ))}

      {!isLoading && hasSearched && results.length === 0 && !error ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>
            По запросу ничего не найдено. Попробуйте другое название.
          </Text>
        </View>
      ) : null}

      {!hasSearched ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>
            Начните с поиска фильма, сериала, дорамы, аниме или мультсериала. После открытия карточки
            можно сохранить заметку и создать комнату просмотра по прямой ссылке на видео.
          </Text>
        </View>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  movieCard: {
    flexDirection: 'row',
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
});
