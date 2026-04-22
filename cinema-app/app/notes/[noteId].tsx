import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
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
  acceptNote,
  ApiError,
  getFriends,
  getNotes,
  rejectNote,
  shareNote,
  updateNote,
} from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import type { Friend, MovieNote } from '@/types/app';

type NoteSource = 'own' | 'incoming';

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function NoteEditorScreen() {
  const router = useRouter();
  const { noteId: noteIdParam } = useLocalSearchParams<{ noteId: string }>();
  const noteId = Number(readParam(noteIdParam));
  const { token } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [note, setNote] = useState<MovieNote | null>(null);
  const [noteSource, setNoteSource] = useState<NoteSource>('own');
  const [noteText, setNoteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = noteSource === 'own';
  const canRespond = noteSource === 'incoming' && note?.status === 'sent';

  const loadData = useCallback(async () => {
    if (!token || !Number.isFinite(noteId)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [notesPayload, friendsPayload] = await Promise.all([getNotes(token), getFriends(token)]);
      const ownNote = notesPayload.own.find((item) => item.id === noteId);
      const incomingNote = notesPayload.incoming.find((item) => item.id === noteId);
      const nextNote = ownNote ?? incomingNote ?? null;

      setFriends(friendsPayload);
      setNote(nextNote);
      setNoteSource(ownNote ? 'own' : 'incoming');
      setNoteText(nextNote?.noteText ?? '');
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить заметку.');
    } finally {
      setIsLoading(false);
    }
  }, [noteId, token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const metaLine = useMemo(() => {
    if (!note) {
      return '';
    }

    return [
      note.mediaType === 'tv' ? 'Сериал' : 'Фильм',
      note.releaseYear ? String(note.releaseYear) : null,
      note.createdAt ? `создано ${formatShortDate(note.createdAt)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }, [note]);

  const handleSave = async () => {
    if (!token || !note || !canEdit) {
      return;
    }

    if (!noteText.trim()) {
      Alert.alert('Пустая заметка', 'Напишите текст заметки перед сохранением.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updated = await updateNote(note.id, noteText.trim(), token);
      setNote(updated);
      setNoteText(updated.noteText);
      Alert.alert('Сохранено', 'Заметка обновлена.');
    } catch (caughtError) {
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось сохранить заметку.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = () => {
    if (!token || !note) {
      return;
    }

    if (friends.length === 0) {
      Alert.alert('Пока нет друзей', 'Добавьте друга во вкладке «Друзья», чтобы отправить заметку.');
      return;
    }

    Alert.alert('Отправить заметку', 'Выберите друга.', [
      { text: 'Отмена', style: 'cancel' },
      ...friends.slice(0, 6).map((friend) => ({
        text: friend.name,
        onPress: async () => {
          try {
            await shareNote(note.id, friend.id, token);
            Alert.alert('Отправлено', 'Заметка отправлена другу.');
            await loadData();
          } catch (caughtError) {
            Alert.alert(
              'Ошибка',
              caughtError instanceof ApiError
                ? caughtError.message
                : 'Не удалось отправить заметку.',
            );
          }
        },
      })),
    ]);
  };

  const handleIncomingAction = async (action: 'accept' | 'reject') => {
    if (!token || !note) {
      return;
    }

    try {
      if (action === 'accept') {
        await acceptNote(note.id, token);
      } else {
        await rejectNote(note.id, token);
      }
      await loadData();
    } catch (caughtError) {
      Alert.alert(
        'Ошибка',
        caughtError instanceof ApiError
          ? caughtError.message
          : 'Не удалось обновить статус заметки.',
      );
    }
  };

  return (
    <AppShell
      title="Заметка"
      subtitle="Отдельный экран редактирования: теперь заметки не перекидывают в поиск или комнату просмотра.">
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backButtonText}>Назад</Text>
      </Pressable>

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

      {!isLoading && !note ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>Заметка не найдена или уже недоступна.</Text>
        </View>
      ) : null}

      {note ? (
        <>
          <View style={[sharedStyles.card, styles.noteCard]}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.movieTitle}>{note.movieTitle}</Text>
                <Text style={sharedStyles.helperText}>{metaLine}</Text>
                <Text style={sharedStyles.helperText}>
                  {noteSource === 'own'
                    ? 'Это ваша заметка. Можно редактировать и отправлять друзьям.'
                    : `Заметка от ${note.owner?.name ?? 'друга'}.`}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {note.status === 'pending'
                    ? 'черновик'
                    : note.status === 'sent'
                      ? 'отправлена'
                      : note.status === 'accepted'
                        ? 'принята'
                        : 'отклонена'}
                </Text>
              </View>
            </View>
          </View>

          <View style={[sharedStyles.card, styles.editorCard]}>
            <Text style={styles.sectionTitle}>{canEdit ? 'Редактировать текст' : 'Текст заметки'}</Text>
            <TextInput
              editable={canEdit}
              multiline
              onChangeText={setNoteText}
              placeholder="Ваши мысли, идеи и планы на просмотр..."
              placeholderTextColor={AppColors.textSecondary}
              style={[sharedStyles.input, styles.noteInput, !canEdit && styles.noteInputReadonly]}
              textAlignVertical="top"
              value={noteText}
            />

            {canEdit ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void handleSave()}
                  style={[sharedStyles.primaryButton, styles.flexButton]}>
                  {isSaving ? (
                    <ActivityIndicator color={AppColors.textPrimary} />
                  ) : (
                    <Text style={sharedStyles.primaryButtonText}>Сохранить</Text>
                  )}
                </Pressable>
                <Pressable onPress={handleShare} style={[sharedStyles.secondaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.secondaryButtonText}>Отправить</Text>
                </Pressable>
              </View>
            ) : null}

            {canRespond ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void handleIncomingAction('accept')}
                  style={[sharedStyles.primaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.primaryButtonText}>Принять</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleIncomingAction('reject')}
                  style={[sharedStyles.secondaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.secondaryButtonText}>Отклонить</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[sharedStyles.card, styles.actionsCard]}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/movie/[tmdbId]',
                  params: {
                    mediaType: note.mediaType,
                    tmdbId: String(note.tmdbId),
                  },
                })
              }
              style={sharedStyles.secondaryButton}>
              <Text style={sharedStyles.secondaryButtonText}>Открыть карточку фильма</Text>
            </Pressable>
          </View>
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
  actionsCard: {
    gap: 10,
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
  editorCard: {
    gap: 12,
  },
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  flexButton: {
    flex: 1,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  movieTitle: {
    color: AppColors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  noteCard: {
    gap: 12,
  },
  noteInput: {
    minHeight: 190,
  },
  noteInputReadonly: {
    opacity: 0.9,
  },
  sectionTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    backgroundColor: AppColors.cardMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
});
