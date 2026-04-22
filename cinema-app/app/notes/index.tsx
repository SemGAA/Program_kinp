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
  accepted: 'принята',
  pending: 'черновик',
  rejected: 'отклонена',
  sent: 'отправлена',
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
      setError(caughtError instanceof ApiError ? caughtError.message : 'Не удалось загрузить заметки.');
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
      Alert.alert('Пока нет друзей', 'Сначала добавьте друга во вкладке «Друзья».');
      return;
    }

    Alert.alert('Поделиться заметкой', 'Выберите друга, которому отправить заметку.', [
      { text: 'Отмена', style: 'cancel' },
      ...friends.slice(0, 6).map((friend) => ({
        text: friend.name,
        onPress: async () => {
          try {
            await shareNote(note.id, friend.id, token);
            await loadData();
          } catch (caughtError) {
            Alert.alert(
              'Ошибка',
              caughtError instanceof ApiError
                ? caughtError.message
                : 'Не удалось поделиться заметкой.',
            );
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
      Alert.alert(
        'Ошибка',
        caughtError instanceof ApiError
          ? caughtError.message
          : 'Не удалось обновить статус заметки.',
      );
    }
  };

  const openNote = (note: MovieNote) => {
    router.push({
      pathname: '/notes/[noteId]',
      params: { noteId: String(note.id) },
    });
  };

  const visibleNotes = activeTab === 'own' ? notes.own : notes.incoming;

  return (
    <AppShell
      title="Заметки"
      subtitle="Личные черновики и рекомендации от друзей. Нажатие по заметке теперь открывает редактор заметки, а не поиск или комнату.">
      <View style={styles.tabsRow}>
        <Pressable
          onPress={() => setActiveTab('own')}
          style={[styles.tabButton, activeTab === 'own' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, activeTab === 'own' && styles.tabTextActive]}>Мои</Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('incoming')}
          style={[styles.tabButton, activeTab === 'incoming' && styles.tabButtonActive]}>
          <Text style={[styles.tabText, activeTab === 'incoming' && styles.tabTextActive]}>Входящие</Text>
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
            onPress={() => openNote(note)}
            style={[sharedStyles.card, styles.noteCard]}>
            <View style={styles.noteHeader}>
              <View style={styles.noteHeading}>
                <Text style={styles.movieTitle}>{note.movieTitle}</Text>
                <Text style={sharedStyles.helperText}>
                  {(note.mediaType === 'tv' ? 'Сериал' : 'Фильм') +
                    (note.releaseYear ? ` · ${note.releaseYear}` : ' · год неизвестен')}
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
              {note.recipient ? ` · получатель ${note.recipient.name}` : ''}
              {note.owner ? ` · от ${note.owner.name}` : ''}
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
              ? 'У вас пока нет заметок. Начните с поиска и сохраните первое впечатление.'
              : 'Входящих заметок пока нет.'}
          </Text>
          {activeTab === 'own' ? (
            <Pressable onPress={() => router.push('/search')} style={sharedStyles.primaryButton}>
              <Text style={sharedStyles.primaryButtonText}>Открыть поиск</Text>
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
    paddingVertical: 8,
  },
  statusBadgeText: {
    color: AppColors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  tabButton: {
    alignItems: 'center',
    backgroundColor: AppColors.cardMuted,
    borderColor: AppColors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 12,
  },
  tabButtonActive: {
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
