import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell, sharedStyles } from '@/components/app-shell';
import { AppColors } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { acceptNote, ApiError, getFriends, getNotes, rejectNote, shareNote } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import type { Friend, MovieNote, NotesPayload } from '@/types/app';

type TabKey = 'own' | 'incoming';

const STATUS_LABELS: Record<MovieNote['status'], string> = {
  accepted: 'принято',
  pending: 'черновик',
  rejected: 'отклонено',
  sent: 'отправлено',
};

export default function NotesScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('own');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [notes, setNotes] = useState<NotesPayload>({ incoming: [], own: [] });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [notesPayload, friendsPayload] = await Promise.all([getNotes(token), getFriends(token)]);
      setNotes(notesPayload);
      setFriends(friendsPayload);
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить заметки.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  const handleShare = (note: MovieNote) => {
    if (!token) {
      return;
    }

    if (friends.length === 0) {
      Alert.alert('Нет друзей', 'Сначала добавьте друга по email на вкладке друзей.');
      return;
    }

    Alert.alert('Отправить заметку', 'Выберите друга, которому хотите отправить заметку.', [
      { text: 'Отмена', style: 'cancel' },
      ...friends.slice(0, 6).map((friend) => ({
        text: friend.name,
        onPress: async () => {
          try {
            await shareNote(note.id, friend.id, token);
            await loadData();
          } catch (caughtError) {
            const message =
              caughtError instanceof ApiError
                ? caughtError.message
                : 'Не удалось отправить заметку.';
            Alert.alert('Ошибка', message);
          }
        },
      })),
    ]);
  };

  const handleIncomingAction = async (noteId: number, action: 'accept' | 'reject') => {
    if (!token) {
      return;
    }

    try {
      if (action === 'accept') {
        await acceptNote(noteId, token);
      } else {
        await rejectNote(noteId, token);
      }
      await loadData();
    } catch (caughtError) {
      const message =
        caughtError instanceof ApiError ? caughtError.message : 'Не удалось обновить статус заметки.';
      Alert.alert('Ошибка', message);
    }
  };

  const openOwnNote = (note: MovieNote) => {
    router.push({
      pathname: '/movie/[tmdbId]',
      params: {
        tmdbId: String(note.tmdbId),
        noteId: String(note.id),
        initialNote: note.noteText,
      },
    });
  };

  const openIncomingNote = (note: MovieNote) => {
    router.push({
      pathname: '/movie/[tmdbId]',
      params: {
        tmdbId: String(note.tmdbId),
        sharedNote: note.noteText,
        fromName: note.owner?.name ?? 'Друг',
      },
    });
  };

  const visibleNotes = activeTab === 'own' ? notes.own : notes.incoming;

  return (
    <AppShell
      title="Заметки"
      subtitle="В черновиках хранится ваш личный контекст, а во входящих — заметки друзей с приглашением на просмотр.">
      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setActiveTab('own')}
          style={[styles.tabButton, activeTab === 'own' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, activeTab === 'own' && styles.tabTextActive]}>Мои</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('incoming')}
          style={[styles.tabButton, activeTab === 'incoming' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, activeTab === 'incoming' && styles.tabTextActive]}>
            Входящие
          </Text>
        </Pressable>
      </View>

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

      {!isLoading &&
        visibleNotes.map((note) => (
          <Pressable
            key={`${activeTab}-${note.id}`}
            onPress={() => (activeTab === 'own' ? openOwnNote(note) : openIncomingNote(note))}
            style={[sharedStyles.card, styles.noteCard]}>
            <View style={styles.noteHeader}>
              <View style={styles.noteHeading}>
                <Text style={styles.movieTitle}>{note.movieTitle}</Text>
                <Text style={sharedStyles.helperText}>
                  {note.releaseYear ? `${note.releaseYear}` : 'Год не указан'}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{STATUS_LABELS[note.status]}</Text>
              </View>
            </View>

            <Text numberOfLines={4} style={sharedStyles.helperText}>
              {note.noteText}
            </Text>

            <Text style={styles.metaText}>
              Создано {formatShortDate(note.createdAt)}
              {note.recipient ? ` • получатель ${note.recipient.name}` : ''}
              {note.owner ? ` • от ${note.owner.name}` : ''}
            </Text>

            {activeTab === 'own' && (note.status === 'pending' || note.status === 'rejected') ? (
              <Pressable onPress={() => handleShare(note)} style={sharedStyles.secondaryButton}>
                <Text style={sharedStyles.secondaryButtonText}>Отправить другу</Text>
              </Pressable>
            ) : null}

            {activeTab === 'incoming' && note.status === 'sent' ? (
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => void handleIncomingAction(note.id, 'accept')}
                  style={[sharedStyles.primaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.primaryButtonText}>Принять</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleIncomingAction(note.id, 'reject')}
                  style={[sharedStyles.secondaryButton, styles.flexButton]}>
                  <Text style={sharedStyles.secondaryButtonText}>Отклонить</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        ))}

      {!isLoading && !error && visibleNotes.length === 0 ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.emptyText}>
            {activeTab === 'own'
              ? 'У вас пока нет заметок. Начните с поиска фильма.'
              : 'Входящих приглашений пока нет.'}
          </Text>
          {activeTab === 'own' ? (
            <Pressable onPress={() => router.push('/search')} style={sharedStyles.primaryButton}>
              <Text style={sharedStyles.primaryButtonText}>Перейти к поиску</Text>
            </Pressable>
          ) : null}
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
  errorText: {
    color: '#FF9A8B',
    fontSize: 14,
    lineHeight: 20,
  },
  flexButton: {
    flex: 1,
  },
  metaText: {
    color: AppColors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  movieTitle: {
    color: AppColors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  noteCard: {
    gap: 12,
  },
  noteHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  noteHeading: {
    flex: 1,
    gap: 4,
  },
  statusBadge: {
    backgroundColor: AppColors.cardMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusBadgeText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: AppColors.card,
    borderColor: AppColors.border,
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  tabButtonActive: {
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.accent,
  },
  tabText: {
    color: AppColors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  tabTextActive: {
    color: AppColors.textPrimary,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});