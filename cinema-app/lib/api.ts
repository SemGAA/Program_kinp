import { DEFAULT_API_BASE_URL } from '@/lib/config';
import {
  getDirectMovieDetails,
  getDirectMovieRecommendations,
  hasDirectTmdbConfig,
  searchDirectTmdb,
} from '@/lib/tmdb-direct';
import { searchAutoVideoCatalog } from '@/lib/auto-video';
import { searchInternetArchiveVideos } from '@/lib/internet-archive';
import { searchJellyfinCatalog } from '@/lib/jellyfin';
import { searchShikimoriAnime } from '@/lib/shikimori';
import type {
  AuthResponse,
  AuthUser,
  Friend,
  FriendRequest,
  FriendRequestsPayload,
  MediaType,
  MovieDetails,
  MovieNote,
  MovieRecommendation,
  MovieSearchResult,
  NotesPayload,
  PersonPreview,
  RegistrationChallenge,
  UserProfile,
  UserSearchResult,
  VideoSource,
  WatchPlayback,
  WatchRoom,
  WatchRoomInvite,
  WatchRoomInvitesPayload,
  WatchRoomMessage,
  WatchRoomShare,
  WatchRoomSummary,
} from '@/types/app';

type RequestOptions = {
  body?: unknown;
  method?: 'DELETE' | 'GET' | 'POST' | 'PATCH';
  token?: string | null;
};

type NotesCacheEntry = {
  expiresAt: number;
  value: NotesPayload;
};

const NOTES_CACHE_TTL_MS = 30 * 1000;
const notesCache = new Map<string, NotesCacheEntry>();
const API_REQUEST_TIMEOUT_MS = 15000;
const APP_SCHEME = 'cinemaapp';
const FALLBACK_VIDEO_SOURCE: VideoSource = {
  embedUrl: null,
  embeddable: false,
  kind: 'none',
  label: 'Источник не подключён',
  provider: null,
  videoId: null,
};

class ApiError extends Error {
  payload: unknown;
  status: number;

  constructor(message: string, status: number, payload: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.payload = payload;
    this.status = status;
  }
}

class ApiConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConnectionError';
  }
}

function extractErrorMessage(payload: unknown, fallbackStatus: number) {
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as {
      errors?: Record<string, string[]>;
      message?: string;
    };

    const firstValidationError = objectPayload.errors
      ? Object.values(objectPayload.errors).flat().find(Boolean)
      : null;

    if (firstValidationError) {
      return translateServerMessage(firstValidationError);
    }

    if (objectPayload.message) {
      return translateServerMessage(objectPayload.message);
    }
  }

  if (fallbackStatus === 401) {
    return 'Нужна авторизация. Войдите снова.';
  }

  return fallbackStatus >= 500
    ? 'Сервер временно недоступен. Попробуйте позже.'
    : 'Запрос не выполнен.';
}

function translateServerMessage(message: string) {
  const normalized = String(message || '').trim();

  const translations: Record<string, string> = {
    'A new verification code has been sent.': 'Новый код подтверждения отправлен.',
    'A user with this email already exists.': 'Пользователь с таким email уже существует.',
    'Authentication required.': 'Нужна авторизация.',
    'Email and password are required.': 'Укажите email и пароль.',
    'Email and verification code are required.': 'Укажите email и код подтверждения.',
    'Email is already verified. Please sign in.': 'Email уже подтвержден. Войдите в аккаунт.',
    'Email is required.': 'Укажите email.',
    'Friend not found.': 'Друг не найден.',
    'Invalid email or password.': 'Неверный email или пароль.',
    'Invalid verification code.': 'Неверный код подтверждения.',
    'Join the room first.': 'Сначала войдите в комнату.',
    'Message text is required.': 'Введите текст сообщения.',
    'Movie title is required.': 'Укажите название фильма или видео.',
    'Only the host can control playback.': 'Только ведущий может управлять просмотром.',
    'Only the host can invite friends.': 'Только ведущий может приглашать друзей.',
    'Only the host can update the source.': 'Только ведущий может менять источник видео.',
    'Please confirm your email before signing in.': 'Сначала подтвердите email, чтобы войти.',
    'Please provide a valid email.': 'Укажите корректный email.',
    'Please request a new verification code.': 'Запросите новый код подтверждения.',
    'Please wait before requesting another verification code.': 'Подождите немного перед повторной отправкой кода.',
    'Query must be at least 2 characters.': 'Введите хотя бы 2 символа для поиска.',
    'Request already sent.': 'Заявка уже отправлена.',
    'Request body must be valid JSON.': 'Тело запроса должно быть в формате JSON.',
    'Room code is required.': 'Введите код комнаты.',
    'Room not found.': 'Комната не найдена.',
    'Session expired.': 'Сессия истекла. Войдите снова.',
    'Signed out.': 'Вы вышли из аккаунта.',
    'User not found.': 'Пользователь не найден.',
    'Users are already friends.': 'Вы уже в друзьях.',
    'Verification code has expired. Request a new one.': 'Код подтверждения истек. Запросите новый.',
    'Verification code sent. Please confirm your email to finish registration.':
      'Код подтверждения отправлен. Подтвердите email, чтобы завершить регистрацию.',
    'Video URL must be a valid URL.': 'URL видео должен быть корректным.',
  };

  return translations[normalized] ?? normalized;
}

function normalizePersonPreview(person: PersonPreview | null | undefined): PersonPreview | null {
  if (!person) {
    return null;
  }

  return {
    avatarTheme: person.avatarTheme || 'sunset',
    avatarUrl: person.avatarUrl ?? null,
    email: person.email || '',
    id: Number(person.id),
    name: person.name || 'Пользователь',
    username: person.username ?? null,
  };
}

function buildFallbackDeepLink(code: string) {
  const normalizedCode = String(code || '').trim().toUpperCase();
  return normalizedCode
    ? `${APP_SCHEME}://watch/${encodeURIComponent(normalizedCode)}`
    : `${APP_SCHEME}://watch`;
}

function normalizeVideoSource(source: VideoSource | null | undefined): VideoSource {
  if (!source) {
    return FALLBACK_VIDEO_SOURCE;
  }

  const kind = source.kind ?? 'none';
  const provider = source.provider ?? null;
  const fallbackLabel =
    kind === 'youtube'
      ? 'YouTube'
      : kind === 'direct'
        ? 'Прямое видео'
        : kind === 'external'
          ? provider || 'Внешний источник'
          : FALLBACK_VIDEO_SOURCE.label;

  return {
    embedUrl: source.embedUrl ?? null,
    embeddable: Boolean(source.embeddable),
    kind,
    label: kind === 'none' ? FALLBACK_VIDEO_SOURCE.label : source.label || fallbackLabel,
    provider,
    videoId: source.videoId ?? null,
  };
}

function normalizeAuthUser(user: Partial<AuthUser> | null | undefined): AuthUser {
  return {
    avatarTheme: user?.avatarTheme || 'sunset',
    avatarUrl: user?.avatarUrl ?? null,
    bio: user?.bio || '',
    email: user?.email || '',
    emailVerifiedAt: user?.emailVerifiedAt ?? null,
    id: Number(user?.id ?? 0),
    isEmailVerified: Boolean(user?.isEmailVerified ?? user?.emailVerifiedAt),
    name: user?.name || 'Пользователь',
    stats: {
      friends: Number(user?.stats?.friends ?? 0),
      notes: Number(user?.stats?.notes ?? 0),
      rooms: Number(user?.stats?.rooms ?? 0),
    },
    username: user?.username ?? null,
  };
}

function normalizeWatchPlayback(playback: WatchPlayback | null | undefined): WatchPlayback {
  return {
    lastSyncedAt: playback?.lastSyncedAt ?? null,
    lastSyncedByUserId: playback?.lastSyncedByUserId ?? null,
    positionMs: Number.isFinite(playback?.positionMs) ? Number(playback?.positionMs) : 0,
    rate: Number.isFinite(playback?.rate) ? Number(playback?.rate) : 1,
    state:
      playback?.state === 'playing' || playback?.state === 'ended' || playback?.state === 'paused'
        ? playback.state
        : 'paused',
  };
}

function normalizeWatchRoomShare(
  share: WatchRoomShare | null | undefined,
  code: string,
  movieTitle: string,
): WatchRoomShare {
  const deepLink = share?.deepLink?.trim() || buildFallbackDeepLink(code);
  const inviteText =
    share?.inviteText?.trim() ||
    [
      'Привет! Приглашаю тебя на совместный просмотр в Cinema Notes.',
      `Что смотрим: ${movieTitle}`,
      `Код комнаты: ${code}`,
      `Открыть комнату: ${deepLink}`,
    ].join('\n');

  return {
    deepLink,
    inviteText,
  };
}

function normalizeWatchRoomSummary(room: WatchRoomSummary | null | undefined): WatchRoomSummary {
  const code = String(room?.code || '').trim().toUpperCase();
  const movieTitle = room?.movieTitle || 'Комната просмотра';

  return {
    code,
    hasVideoSource: Boolean(room?.hasVideoSource),
    host: normalizePersonPreview(room?.host),
    isHost: Boolean(room?.isHost),
    mediaType: room?.mediaType === 'tv' ? 'tv' : 'movie',
    memberCount: Number.isFinite(room?.memberCount) ? Math.max(1, Number(room?.memberCount)) : 1,
    movieTitle,
    playback: normalizeWatchPlayback(room?.playback),
    posterPath: room?.posterPath ?? null,
    posterUrl: room?.posterUrl ?? null,
    releaseYear: room?.releaseYear ?? null,
    share: normalizeWatchRoomShare(room?.share, code, movieTitle),
    source: normalizeVideoSource(room?.source),
    updatedAt: room?.updatedAt ?? null,
  };
}

function normalizeWatchRoomMessage(message: WatchRoomMessage | null | undefined): WatchRoomMessage {
  return {
    body: message?.body || '',
    createdAt: message?.createdAt ?? null,
    id: Number(message?.id ?? 0),
    kind:
      message?.kind === 'note' || message?.kind === 'system' || message?.kind === 'chat'
        ? message.kind
        : 'chat',
    user: normalizePersonPreview(message?.user),
  };
}

function normalizeWatchRoom(room: WatchRoom | null | undefined): WatchRoom {
  const summary = normalizeWatchRoomSummary(room);

  return {
    ...summary,
    members: Array.isArray(room?.members)
      ? room.members
          .map((member) => {
            const person = normalizePersonPreview(member);
            if (!person) {
              return null;
            }

            return {
              ...person,
              lastSeenAt: member.lastSeenAt ?? null,
            };
          })
          .filter(Boolean) as WatchRoom['members']
      : [],
    messages: Array.isArray(room?.messages) ? room.messages.map(normalizeWatchRoomMessage) : [],
    tmdbId: room?.tmdbId ?? null,
    videoUrl: room?.videoUrl ?? null,
  };
}

function normalizeWatchRoomInvite(invite: WatchRoomInvite | null | undefined): WatchRoomInvite {
  return {
    createdAt: invite?.createdAt ?? null,
    id: Number(invite?.id ?? 0),
    recipient: normalizePersonPreview(invite?.recipient),
    respondedAt: invite?.respondedAt ?? null,
    room: normalizeWatchRoomSummary(invite?.room),
    sender: normalizePersonPreview(invite?.sender),
    status:
      invite?.status === 'accepted' || invite?.status === 'rejected' || invite?.status === 'pending'
        ? invite.status
        : 'pending',
  };
}

function normalizeWatchRoomInvitesPayload(
  payload: WatchRoomInvitesPayload | null | undefined,
): WatchRoomInvitesPayload {
  return {
    incoming: Array.isArray(payload?.incoming) ? payload.incoming.map(normalizeWatchRoomInvite) : [],
    outgoing: Array.isArray(payload?.outgoing) ? payload.outgoing.map(normalizeWatchRoomInvite) : [],
  };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);

  try {
    response = await fetch(`${DEFAULT_API_BASE_URL}${path}`, {
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      headers,
      method: options.method ?? 'GET',
      signal: controller.signal,
    });
  } catch {
    throw new ApiConnectionError('Не удалось подключиться к приложению. Проверьте интернет-соединение и попробуйте ещё раз.');
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload, response.status), response.status, payload);
  }

  return payload as T;
}

function readNotesCache(token: string) {
  const cached = notesCache.get(token);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    notesCache.delete(token);
    return null;
  }

  return cached.value;
}

function writeNotesCache(token: string, value: NotesPayload) {
  notesCache.set(token, {
    expiresAt: Date.now() + NOTES_CACHE_TTL_MS,
    value,
  });
}

function invalidateNotesCache(token: string) {
  notesCache.delete(token);
}

function mergeMovieSearchResults(results: MovieSearchResult[]) {
  const seen = new Set<string>();

  return results.filter((item) => {
    const sourceKey = item.sourceProvider || item.sourceKind || 'catalog';
    const key = item.videoUrl ? `video:${item.videoUrl}` : `${sourceKey}:${item.mediaType}:${item.id}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export async function registerUser(payload: {
  email: string;
  name: string;
  password: string;
}) {
  return request<RegistrationChallenge>('/register', {
    body: payload,
    method: 'POST',
  });
}

export async function verifyRegistrationCode(payload: { code: string; email: string }) {
  const response = await request<AuthResponse>('/register/verify', {
    body: payload,
    method: 'POST',
  });

  return {
    ...response,
    user: normalizeAuthUser(response.user),
  };
}

export async function resendRegistrationCode(email: string) {
  return request<RegistrationChallenge>('/register/resend', {
    body: { email },
    method: 'POST',
  });
}

export async function loginUser(payload: { email: string; password: string }) {
  const response = await request<AuthResponse>('/login', {
    body: payload,
    method: 'POST',
  });

  return {
    ...response,
    user: normalizeAuthUser(response.user),
  };
}

export async function logoutUser(token: string) {
  return request<{ message: string }>('/logout', {
    method: 'POST',
    token,
  });
}

export async function getCurrentUser(token: string) {
  const response = await request<AuthUser>('/user', {
    token,
  });

  return normalizeAuthUser(response);
}

export async function searchMovies(query: string, token: string) {
  const jellyfinPromise = searchJellyfinCatalog(query).catch(() => [] as MovieSearchResult[]);
  const legalVideoPromise = searchInternetArchiveVideos(query).catch(() => [] as MovieSearchResult[]);
  const shikimoriPromise = searchShikimoriAnime(query).catch(() => [] as MovieSearchResult[]);
  const catalogPromise = (async () => {
    if (hasDirectTmdbConfig()) {
      try {
        return await searchDirectTmdb(query);
      } catch {
        // Fall back to the public backend if direct TMDB access is unavailable.
      }
    }

    const payload = await request<{ data: MovieSearchResult[] }>(
      `/movies/search?q=${encodeURIComponent(query)}`,
      { token },
    ).catch(() => ({ data: [] as MovieSearchResult[] }));

    return payload.data;
  })();

  const videoPromise = searchAutoVideoCatalog(query).catch(() => [] as MovieSearchResult[]);
  const [jellyfinResults, legalVideoResults, shikimoriResults, catalogResults, videoResults] = await Promise.all([
    jellyfinPromise,
    legalVideoPromise,
    shikimoriPromise,
    catalogPromise,
    videoPromise,
  ]);

  return mergeMovieSearchResults([
    ...jellyfinResults,
    ...legalVideoResults,
    ...shikimoriResults,
    ...catalogResults,
    ...videoResults,
  ]).slice(0, 30);
}

export async function getMovieDetails(tmdbId: number, mediaType: MediaType, token: string) {
  if (hasDirectTmdbConfig()) {
    try {
      return await getDirectMovieDetails(tmdbId, mediaType);
    } catch {
      // Fall back to the public backend if direct TMDB access is unavailable.
    }
  }

  const payload = await request<{ data: MovieDetails }>(
    `/movies/${tmdbId}?mediaType=${encodeURIComponent(mediaType)}`,
    { token },
  );
  return payload.data;
}

export async function getMovieRecommendations(
  tmdbId: number,
  mediaType: MediaType,
  note: string,
  token: string,
) {
  if (hasDirectTmdbConfig()) {
    try {
      return await getDirectMovieRecommendations(tmdbId, mediaType);
    } catch {
      // Fall back to the public backend if direct TMDB access is unavailable.
    }
  }

  const params = new URLSearchParams();
  params.set('mediaType', mediaType);
  if (note) {
    params.set('note', note);
  }

  const payload = await request<{ data: MovieRecommendation[] }>(
    `/movies/${tmdbId}/recommendations?${params.toString()}`,
    { token },
  );

  return payload.data;
}

export async function getNotes(token: string) {
  const cached = readNotesCache(token);
  if (cached) {
    return cached;
  }

  const payload = await request<NotesPayload>('/notes', { token });
  writeNotesCache(token, payload);
  return payload;
}

export async function getMatchedNote(tmdbId: number, mediaType: MediaType, token: string) {
  const payload = await request<{ data: MovieNote | null }>(
    `/notes/match?tmdbId=${encodeURIComponent(String(tmdbId))}&mediaType=${encodeURIComponent(mediaType)}`,
    { token },
  );

  return payload.data;
}

export async function createNote(
  payload: {
    movie_title: string;
    note_text: string;
    media_type?: MediaType;
    poster_path?: string | null;
    release_year?: number | null;
    tmdb_id: number;
  },
  token: string,
) {
  const response = await request<{ data: MovieNote }>('/notes', {
    body: payload,
    method: 'POST',
    token,
  });

  invalidateNotesCache(token);
  return response.data;
}

export async function updateNote(noteId: number, noteText: string, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}`, {
    body: { note_text: noteText },
    method: 'PATCH',
    token,
  });

  invalidateNotesCache(token);
  return response.data;
}

export async function shareNote(noteId: number, recipientId: number, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}/share`, {
    body: { recipient_id: recipientId },
    method: 'POST',
    token,
  });

  invalidateNotesCache(token);
  return response.data;
}

export async function acceptNote(noteId: number, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}/accept`, {
    method: 'POST',
    token,
  });

  invalidateNotesCache(token);
  return response.data;
}

export async function rejectNote(noteId: number, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}/reject`, {
    method: 'POST',
    token,
  });

  invalidateNotesCache(token);
  return response.data;
}

export async function getFriends(token: string) {
  const payload = await request<{ data: Friend[] }>('/friends', { token });
  return payload.data;
}

export async function getFriendRequests(token: string) {
  return request<FriendRequestsPayload>('/friend-requests', { token });
}

export async function sendFriendRequest(email: string, token: string) {
  const payload = await request<{ data: FriendRequest }>('/friend-requests', {
    body: { email },
    method: 'POST',
    token,
  });

  return payload.data;
}

export async function acceptFriendRequest(requestId: number, token: string) {
  const payload = await request<{ data: Friend }>(`/friend-requests/${requestId}/accept`, {
    method: 'POST',
    token,
  });

  return payload.data;
}

export async function rejectFriendRequest(requestId: number, token: string) {
  return request<{ message: string }>(`/friend-requests/${requestId}/reject`, {
    method: 'POST',
    token,
  });
}

export async function removeFriend(friendshipId: number, token: string) {
  return request<{ message: string }>(`/friends/${friendshipId}`, {
    method: 'DELETE',
    token,
  });
}

export async function searchUsers(query: string, token: string) {
  const payload = await request<{ data: UserSearchResult[] }>(
    `/users/search?q=${encodeURIComponent(query)}`,
    { token },
  );

  return payload.data;
}

export async function getUserProfile(userId: number, token: string) {
  const payload = await request<{ data: UserProfile }>(`/users/${userId}`, { token });
  return payload.data;
}

export async function updateProfile(
  payload: {
    avatar_theme?: string;
    avatar_url?: string | null;
    bio?: string;
    name?: string;
    username?: string;
  },
  token: string,
) {
  const response = await request<{ data: AuthUser }>('/profile', {
    body: payload,
    method: 'PATCH',
    token,
  });

  return normalizeAuthUser(response.data);
}

export async function getWatchRooms(token: string) {
  const payload = await request<{ data: WatchRoomSummary[] }>('/watch-rooms', { token });
  return Array.isArray(payload.data) ? payload.data.map(normalizeWatchRoomSummary) : [];
}

export async function createWatchRoom(
  payload: {
    movie_title: string;
    media_type?: MediaType;
    poster_path?: string | null;
    release_year?: number | null;
    tmdb_id?: number | null;
    video_url?: string;
  },
  token: string,
) {
  const response = await request<{ data: WatchRoom }>('/watch-rooms', {
    body: payload,
    method: 'POST',
    token,
  });

  return normalizeWatchRoom(response.data);
}

export async function joinWatchRoom(code: string, token: string) {
  const response = await request<{ data: WatchRoom }>('/watch-rooms/join', {
    body: { code },
    method: 'POST',
    token,
  });

  return normalizeWatchRoom(response.data);
}

export async function getWatchRoom(code: string, token: string) {
  const response = await request<{ data: WatchRoom }>(`/watch-rooms/${encodeURIComponent(code)}`, {
    token,
  });

  return normalizeWatchRoom(response.data);
}

export async function deleteWatchRoom(code: string, token: string) {
  return request<{ message: string }>(`/watch-rooms/${encodeURIComponent(code)}`, {
    method: 'DELETE',
    token,
  });
}

export async function updateWatchRoomSource(code: string, videoUrl: string, token: string) {
  const response = await request<{ data: WatchRoom }>(
    `/watch-rooms/${encodeURIComponent(code)}/source`,
    {
      body: { video_url: videoUrl },
      method: 'PATCH',
      token,
    },
  );

  return normalizeWatchRoom(response.data);
}

export async function syncWatchRoomPlayback(
  code: string,
  payload: {
    playback_position_ms: number;
    playback_rate?: number;
    playback_state: 'playing' | 'paused' | 'ended';
  },
  token: string,
) {
  const response = await request<{ data: WatchPlayback }>(
    `/watch-rooms/${encodeURIComponent(code)}/sync`,
    {
      body: payload,
      method: 'POST',
      token,
    },
  );

  return response.data;
}

export async function sendWatchRoomMessage(
  code: string,
  payload: {
    body: string;
    kind?: 'chat' | 'note';
  },
  token: string,
) {
  const response = await request<{ data: WatchRoomMessage }>(
    `/watch-rooms/${encodeURIComponent(code)}/messages`,
    {
      body: payload,
      method: 'POST',
      token,
    },
  );

  return normalizeWatchRoomMessage(response.data);
}

export async function getWatchRoomInvites(token: string) {
  const payload = await request<WatchRoomInvitesPayload>('/watch-room-invites', { token });
  return normalizeWatchRoomInvitesPayload(payload);
}

export async function inviteToWatchRoom(code: string, recipientId: number, token: string) {
  const response = await request<{ data: WatchRoomInvite }>(
    `/watch-rooms/${encodeURIComponent(code)}/invite`,
    {
      body: { recipient_id: recipientId },
      method: 'POST',
      token,
    },
  );

  return normalizeWatchRoomInvite(response.data);
}

export async function acceptWatchRoomInvite(inviteId: number, token: string) {
  const response = await request<{ data: WatchRoom }>(`/watch-room-invites/${inviteId}/accept`, {
    method: 'POST',
    token,
  });

  return normalizeWatchRoom(response.data);
}

export async function rejectWatchRoomInvite(inviteId: number, token: string) {
  return request<{ message: string }>(`/watch-room-invites/${inviteId}/reject`, {
    method: 'POST',
    token,
  });
}

export { ApiConnectionError, ApiError };





