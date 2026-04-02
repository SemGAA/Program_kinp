import { useEffect, useMemo, useState } from 'react';
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
import {
  ApiError,
  createNote,
  createWatchRoom,
  getFriends,
  getMatchedNote,
  getMovieDetails,
  getMovieRecommendations,
  inviteToWatchRoom,
  updateNote,
} from '@/lib/api';
import { formatRuntime } from '@/lib/format';
import type { Friend, MediaType, MovieDetails, MovieRecommendation } from '@/types/app';

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function MovieDetailsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const params = useLocalSearchParams<{
    fromName?: string;
    initialMediaLabel?: string;
    initialNote?: string;
    initialOverview?: string;
    initialPosterPath?: string;
    initialPosterUrl?: string;
    initialRating?: string;
    initialReleaseYear?: string;
    initialTitle?: string;
    mediaType?: MediaType;
    noteId?: string;
    sharedNote?: string;
    tmdbId: string;
  }>();

  const tmdbId = Number(readParam(params.tmdbId));
  const mediaType = (readParam(params.mediaType) as MediaType | undefined) ?? 'movie';
  const incomingSharedNote = readParam(params.sharedNote);
  const incomingAuthor = readParam(params.fromName);
  const initialOwnNote = readParam(params.initialNote);
  const initialNoteId = Number(readParam(params.noteId) ?? '0') || null;
  const initialMovie = useMemo<MovieDetails | null>(() => {
    const title = readParam(params.initialTitle)?.trim();
    if (!title || !Number.isFinite(tmdbId)) {
      return null;
    }

    const initialRating = Number(readParam(params.initialRating) ?? '');
    const initialReleaseYear = Number(readParam(params.initialReleaseYear) ?? '');

    return {
      backdropPath: null,
      backdropUrl: null,
      genres: [],
      id: tmdbId,
      mediaLabel: readParam(params.initialMediaLabel) || (mediaType === 'tv' ? 'Сериал' : 'Фильм'),
      mediaType,
      overview: readParam(params.initialOverview) || '',
      posterPath: readParam(params.initialPosterPath) || null,
      posterUrl: readParam(params.initialPosterUrl) || null,
      rating: Number.isFinite(initialRating) ? initialRating : null,
      releaseYear: Number.isFinite(initialReleaseYear) ? initialReleaseYear : null,
      runtime: null,
      title,
    };
  }, [
    mediaType,
    params.initialMediaLabel,
    params.initialOverview,
    params.initialPosterPath,
    params.initialPosterUrl,
    params.initialRating,
    params.initialReleaseYear,
    params.initialTitle,
    tmdbId,
  ]);

  const [movie, setMovie] = useState<MovieDetails | null>(initialMovie);
  const [noteId, setNoteId] = useState<number | null>(initialNoteId);
  const [noteText, setNoteText] = useState(initialOwnNote ?? '');
  const [recommendations, setRecommendations] = useState<MovieRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialMovie);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [invitingFriendId, setInvitingFriendId] = useState<number | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isLoadingNoteState, setIsLoadingNoteState] = useState(false);
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadMovie = async () => {
      if (!token || !Number.isFinite(tmdbId)) {
        setError('Некорректный идентификатор тайтла.');
        setIsLoading(false);
        return;
      }

      if (!initialMovie) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const moviePayload = await getMovieDetails(tmdbId, mediaType, token);
        if (!isMounted) {
          return;
        }

        setMovie(moviePayload);
      } catch (caughtError) {
        if (!isMounted) {
          return;
        }

        const message = caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить карточку.';
        setError(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const loadOwnNote = async () => {
      if (!token || !Number.isFinite(tmdbId)) {
        return;
      }

      if (initialNoteId || initialOwnNote) {
        setNoteId(initialNoteId);
        setNoteText(initialOwnNote ?? '');
        return;
      }

      setIsLoadingNoteState(true);

      try {
        const existingOwnNote = await getMatchedNote(tmdbId, mediaType, token);
        if (!isMounted || !existingOwnNote) {
          return;
        }

        setNoteId(existingOwnNote.id);
        setNoteText(existingOwnNote.noteText);
      } catch {
        // The card should stay responsive even if note lookup fails.
      } finally {
        if (isMounted) {
          setIsLoadingNoteState(false);
        }
      }
    };

    const loadFriends = async () => {
      if (!token) {
        return;
      }

      try {
        const payload = await getFriends(token);
        if (!isMounted) {
          return;
        }

        setFriends(payload);
      } catch {
        // Friend shortcuts should not block the title card.
      }
    };

    void loadMovie();
    void loadOwnNote();
    void loadFriends();

    return () => {
      isMounted = false;
    };
  }, [initialMovie, initialNoteId, initialOwnNote, mediaType, tmdbId, token]);

  const handleSaveNote = async () => {
    if (!token || !movie) {
      return;
    }

    if (!noteText.trim()) {
      Alert.alert('Пустая заметка', 'Добавьте пару строк о тайтле перед сохранением.');
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
            media_type: movie.mediaType,
            movie_title: movie.title,
            note_text: noteText.trim(),
            poster_path: movie.posterPath,
            release_year: movie.releaseYear,
          },
          token,
        );
        setNoteId(createdNote.id);
      }

      Alert.alert('Сохранено', 'Заметка обновлена.');
    } catch (caughtError) {
      const message = caughtError instanceof ApiError ? caughtError.message : 'Не удалось сохранить заметку.';
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
      const recommendationsPayload = await getMovieRecommendations(
        tmdbId,
        mediaType,
        noteText.trim(),
        token,
      );
      setRecommendations(recommendationsPayload);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить рекомендации.';
      setError(message);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!token || !movie) {
      return;
    }

    setIsCreatingRoom(true);
    setError(null);

    try {
      const room = await createWatchRoom(
        {
          movie_title: movie.title,
          media_type: movie.mediaType,
          poster_path: movie.posterPath,
          release_year: movie.releaseYear,
          tmdb_id: movie.id,
        },
        token,
      );

      router.push({
        pathname: '/watch/[code]',
        params: {
          code: room.code,
          initialRoom: JSON.stringify(room),
        },
      });
    } catch (caughtError) {
      const message = caughtError instanceof ApiError ? caughtError.message : 'Не удалось создать комнату.';
      setError(message);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleCreateAndInvite = async (friend: Friend) => {
    if (!token || !movie) {
      return;
    }

    setInvitingFriendId(friend.id);
    setError(null);

    try {
      const room = await createWatchRoom(
        {
          movie_title: movie.title,
          media_type: movie.mediaType,
          poster_path: movie.posterPath,
          release_year: movie.releaseYear,
          tmdb_id: movie.id,
        },
        token,
      );

      await inviteToWatchRoom(room.code, friend.id, token);

      router.push({
        pathname: '/watch/[code]',
        params: {
          code: room.code,
          initialRoom: JSON.stringify(room),
        },
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError
          ? caughtError.message
          : '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u0443 \u0438 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435.';
      setError(message);
    } finally {
      setInvitingFriendId(null);
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
      title={movie?.title ?? 'Карточка тайтла'}
      subtitle="Сохраняйте заметку, подбирайте рекомендации и открывайте комнату совместного просмотра для любого найденного тайтла.">
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
              <Text style={sharedStyles.helperText}>{movie.mediaLabel}</Text>
              <View style={styles.genreRow}>
                {movie.genres.map((genre) => (
                  <View key={genre} style={sharedStyles.chip}>
                    <Text style={sharedStyles.chipText}>{genre}</Text>
                  </View>
                ))}
              </View>
              <Text
                numberOfLines={isOverviewExpanded ? undefined : 3}
                style={sharedStyles.helperText}>
                {movie.overview || '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e.'}
              </Text>
              {movie.overview ? (
                <Pressable
                  onPress={() => setIsOverviewExpanded((currentValue) => !currentValue)}
                  style={styles.inlineButton}>
                  <Text style={styles.inlineButtonText}>
                    {isOverviewExpanded ? '\u0421\u043a\u0440\u044b\u0442\u044c' : '\u0427\u0438\u0442\u0430\u0442\u044c \u043f\u043e\u043b\u043d\u043e\u0441\u0442\u044c\u044e'}
                  </Text>
                </Pressable>
              ) : null}
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
            {isLoadingNoteState && !noteId && !noteText ? (
              <Text style={sharedStyles.helperText}>Подтягиваем вашу заметку...</Text>
            ) : null}
            <TextInput
              multiline
              numberOfLines={6}
              onChangeText={setNoteText}
              placeholder="Напишите, почему этот тайтл стоит посмотреть и что в нём цепляет."
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
                  <Text style={sharedStyles.secondaryButtonText}>Похожие тайтлы</Text>
                )}
              </Pressable>
            </View>
          </View>

          <View style={[sharedStyles.card, styles.roomCard]}>
            <Text style={styles.sectionTitle}>
              {'\u041a\u043e\u043c\u043d\u0430\u0442\u0430 \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430'}
            </Text>
            <Text style={sharedStyles.helperText}>
              {
                '\u041a\u043e\u043c\u043d\u0430\u0442\u0430 \u0441\u043e\u0437\u0434\u0430\u0441\u0442\u0441\u044f \u0441\u0440\u0430\u0437\u0443. \u0414\u0440\u0443\u0433\u0430 \u043c\u043e\u0436\u043d\u043e \u043f\u043e\u0437\u0432\u0430\u0442\u044c \u0443\u0436\u0435 \u0432\u043d\u0443\u0442\u0440\u0438 \u043a\u043e\u043c\u043d\u0430\u0442\u044b. \u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a \u0432\u0438\u0434\u0435\u043e \u043c\u043e\u0436\u043d\u043e \u0434\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043e\u0437\u0436\u0435, \u0435\u0441\u043b\u0438 \u043e\u043d \u0435\u0441\u0442\u044c.'
              }
            </Text>
            <Pressable
              onPress={() => void handleCreateRoom()}
              style={sharedStyles.primaryButton}>
              {isCreatingRoom ? (
                <ActivityIndicator color={AppColors.textPrimary} />
              ) : (
                <Text style={sharedStyles.primaryButtonText}>
                  {'\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u043a\u043e\u043c\u043d\u0430\u0442\u0443'}
                </Text>
              )}
            </Pressable>
            {friends.length > 0 ? (
              <View style={styles.quickInviteBlock}>
                <Text style={sharedStyles.helperText}>
                  {
                    '\u0418\u043b\u0438 \u0441\u0440\u0430\u0437\u0443 \u0441\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043a\u043e\u043c\u043d\u0430\u0442\u0443 \u0438 \u043f\u043e\u0437\u043e\u0432\u0438\u0442\u0435 \u0434\u0440\u0443\u0433\u0430:'
                  }
                </Text>
                <View style={styles.quickInviteRow}>
                  {friends.slice(0, 4).map((friend) => (
                    <Pressable
                      key={friend.id}
                      onPress={() => void handleCreateAndInvite(friend)}
                      style={styles.quickInviteButton}>
                      {invitingFriendId === friend.id ? (
                        <ActivityIndicator color={AppColors.textPrimary} />
                      ) : (
                        <Text style={styles.quickInviteText}>{friend.name}</Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>

          {recommendations.length > 0 ? (
            <View style={styles.recommendationsBlock}>
              <Text style={styles.sectionTitle}>Рекомендации</Text>
              {recommendations.map((recommendation) => (
                <Pressable
                  key={`${recommendation.mediaType}-${recommendation.id}`}
                  onPress={() =>
                    router.push({
                      pathname: '/movie/[tmdbId]',
                      params: {
                        mediaType: recommendation.mediaType,
                        tmdbId: String(recommendation.id),
                      },
                    })
                  }
                  style={[sharedStyles.card, styles.recommendationCard]}>
                  <Text style={styles.recommendationTitle}>{recommendation.title}</Text>
                  <Text style={sharedStyles.helperText}>
                    {recommendation.mediaLabel}
                    {recommendation.releaseYear ? ` • ${recommendation.releaseYear}` : ' • год не указан'}
                    {recommendation.rating ? ` • рейтинг ${recommendation.rating.toFixed(1)}` : ''}
                  </Text>
                  <Text numberOfLines={4} style={sharedStyles.helperText}>
                    {recommendation.overview || 'Описание пока недоступно.'}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  inlineButton: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  inlineButtonText: {
    color: AppColors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
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
  quickInviteBlock: {
    gap: 10,
  },
  quickInviteButton: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickInviteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickInviteText: {
    color: AppColors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  recommendationTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  roomCard: {
    gap: 12,
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
