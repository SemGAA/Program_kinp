import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
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
import {
  ApiError,
  createNote,
  getMovieDetails,
  getMovieRecommendations,
  getNotes,
  updateNote,
} from '@/lib/api';
import { formatRuntime } from '@/lib/format';
import type { MovieDetails, MovieRecommendation } from '@/types/app';

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function MovieDetailsScreen() {
  const { refreshUser, token } = useAuth();
  const params = useLocalSearchParams<{
    fromName?: string;
    initialNote?: string;
    noteId?: string;
    sharedNote?: string;
    tmdbId: string;
  }>();

  const tmdbId = Number(readParam(params.tmdbId));
  const incomingSharedNote = readParam(params.sharedNote);
  const incomingAuthor = readParam(params.fromName);
  const initialOwnNote = readParam(params.initialNote);
  const initialNoteId = Number(readParam(params.noteId) ?? '0') || null;

  const [movie, setMovie] = useState<MovieDetails | null>(null);
  const [noteId, setNoteId] = useState<number | null>(initialNoteId);
  const [noteText, setNoteText] = useState(initialOwnNote ?? '');
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  useEffect(() => {
    const loadMovie = async () => {
      if (!token || !Number.isFinite(tmdbId)) {
        setError('Некорректный идентификатор фильма.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [moviePayload, notesPayload] = await Promise.all([
          getMovieDetails(tmdbId, token),
          getNotes(token),
        ]);

        const existingOwnNote =
          notesPayload.own.find((note) => note.id === initialNoteId) ??
          notesPayload.own.find((note) => note.tmdbId === tmdbId);

        setMovie(moviePayload);

        if (existingOwnNote) {
          setNoteId(existingOwnNote.id);
          setNoteText(existingOwnNote.noteText);
        } else if (initialOwnNote) {
          setNoteText(initialOwnNote);
        }
      } catch (caughtError) {
        const message =
          caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить фильм.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    void loadMovie();
  }, [initialNoteId, initialOwnNote, tmdbId, token]);

  const handleSaveNote = async () => {
    if (!token || !movie) {
      return;
    }

    if (!noteText.trim()) {
      Alert.alert('Пустая заметка', 'Добавьте несколько слов о фильме перед сохранением.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (noteId) {
        await updateNote(noteId, noteText.trim(), token);
      } else {
        const createdNote = await createNote(
          {
            tmdb_id: movie.id,
            movie_title: movie.title,
            note_text: noteText.trim(),
            poster_path: movie.posterPath,
            release_year: movie.releaseYear,
          },
          token,
        );
        setNoteId(createdNote.id);
      }

      await refreshUser();
      Alert.alert('Сохранено', 'Заметка обновлена.');
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError ? caughtError.message : 'Не удалось сохранить заметку.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecommendations = async () => {
    if (!token || !Number.isFinite(tmdbId)) {
      return;
    }

    setIsLoadingRecommendations(true);
    setError(null);

    try {
      const recommendationsPayload = await getMovieRecommendations(tmdbId, noteText.trim(), token);
      setRecommendations(recommendationsPayload);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : 'Не удалось загрузить рекомендации.';
      setError(message);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const movieMeta = useMemo(() => {
    if (!movie) {
      return '';
    }

    const meta = [
      movie.releaseYear ? String(movie.releaseYear) : 'Год не указан',
      formatRuntime(movie.runtime),
      movie.rating ? `рейтинг ${movie.rating.toFixed(1)}` : null,
    ].filter(Boolean);

    return meta.join(' • ');
  }, [movie]);

  return (
    <AppShell
      title={movie?.title ?? 'Карточка фильма'}
      subtitle="Карточка фильма без realtime-функций. Здесь хранятся заметки и рекомендации.">
      {isLoading ? (
        <View style={sharedStyles.card}>
          <ActivityIndicator color={AppColors.accent} />
        </View>
      ) : null}

      {error ? (
        <View style={sharedStyles.card}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {movie ? (
        <>
          <View style={[sharedStyles.card, styles.heroCard]}>
            {movie.posterUrl ? <Image source={{ uri: movie.posterUrl }} style={styles.poster} /> : null}
            <View style={styles.heroCopy}>
              <Text style={styles.movieTitle}>{movie.title}</Text>
              <Text style={sharedStyles.helperText}>{movieMeta}</Text>
              <View style={styles.genreRow}>
                {movie.genres.map((genre) => (
                  <View key={genre} style={sharedStyles.chip}>
                    <Text style={sharedStyles.chipText}>{genre}</Text>
                  </View>
                ))}
              </View>
              <Text style={sharedStyles.helperText}>
                {movie.overview || 'Описание для этого фильма отсутствует.'}
              </Text>
            </View>
          </View>

          {incomingSharedNote ? (
            <View style={sharedStyles.card}>
              <Text style={styles.sectionTitle}>Заметка от {incomingAuthor ?? 'друга'}</Text>
              <Text style={sharedStyles.helperText}>{incomingSharedNote}</Text>
            </View>
          ) : null}

          <View style={[sharedStyles.card, styles.noteCard]}>
            <View style={styles.noteHeader}>
              <Text style={styles.sectionTitle}>Моя заметка</Text>
              {noteId ? (
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>сохранена</Text>
                </View>
              ) : null}
            </View>
            <TextInput
              multiline
              numberOfLines={6}
              onChangeText={setNoteText}
              placeholder="Напишите, кому и почему вы бы посоветовали этот фильм."
              placeholderTextColor={AppColors.textSecondary}
              style={[sharedStyles.input, styles.textArea]}
              textAlignVertical="top"
              value={noteText}
            />
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => void handleSaveNote()}
                style={[sharedStyles.primaryButton, styles.flexButton]}>
                {isSaving ? (
                  <ActivityIndicator color={AppColors.textPrimary} />
                ) : (
                  <Text style={sharedStyles.primaryButtonText}>
                    {noteId ? 'Обновить заметку' : 'Сохранить заметку'}
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => void handleRecommendations()}
                style={[sharedStyles.secondaryButton, styles.flexButton]}>
                {isLoadingRecommendations ? (
                  <ActivityIndicator color={AppColors.textPrimary} />
                ) : (
                  <Text style={sharedStyles.secondaryButtonText}>Подобрать похожие</Text>
                )}
              </Pressable>
            </View>
          </View>

          {recommendations.length > 0 ? (
            <View style={styles.recommendationsBlock}>
              <Text style={styles.sectionTitle}>Рекомендации</Text>
              {recommendations.map((recommendation) => (
                <View key={recommendation.id} style={[sharedStyles.card, styles.recommendationCard]}>
                  <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
                  <Text style={sharedStyles.helperText}>
                    {recommendation.releaseYear ? `${recommendation.releaseYear}` : 'Год не указан'}
                    {recommendation.rating ? ` • рейтинг ${recommendation.rating.toFixed(1)}` : ''}
                  </Text>
                  <Text numberOfLines={4} style={sharedStyles.helperText}>
                    {recommendation.overview || 'Описание пока не доступно.'}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  flexButton: {
    flex: 1,
  },
  genreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroCard: {
    flexDirection: 'row',
    gap: 16,
  },
  heroCopy: {
    flex: 1,
    gap: 10,
  },
  movieTitle: {
    color: AppColors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  noteCard: {
    gap: 12,
  },
  noteHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  poster: {
    borderRadius: 22,
    height: 220,
    width: 148,
  },
  recommendationCard: {
    gap: 8,
  },
  recommendationsBlock: {
    gap: 12,
  },
  recommendationTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  statusPill: {
    backgroundColor: AppColors.cardMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusPillText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  textArea: {
    minHeight: 140,
  },
});