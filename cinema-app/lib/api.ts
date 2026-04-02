import { DEFAULT_API_BASE_URL } from '@/lib/config';
import {
  getDirectMovieDetails,
  getDirectMovieRecommendations,
  hasDirectTmdbConfig,
  searchDirectTmdb,
} from '@/lib/tmdb-direct';
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
  WatchPlayback,
  WatchRoom,
  WatchRoomInvite,
  WatchRoomInvitesPayload,
  WatchRoomMessage,
  WatchRoomSummary,
} from '@/types/app';

type RequestOptions = {
  body?: unknown;
  method?: 'GET' | 'POST' | 'PATCH';
  token?: string | null;
};

type NotesCacheEntry = {
  expiresAt: number;
  value: NotesPayload;
};

const NOTES_CACHE_TTL_MS = 30 * 1000;
const notesCache = new Map<string, NotesCacheEntry>();
const API_REQUEST_TIMEOUT_MS = 8000;

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
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
      return firstValidationError;
    }

    if (objectPayload.message) {
      return objectPayload.message;
    }
  }

  if (fallbackStatus === 401) {
    return 'Неверный email или пароль.';
  }

  return fallbackStatus >= 500
    ? 'Сервер временно недоступен. Попробуйте позже.'
    : 'Запрос не выполнен.';
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
    throw new ApiError(extractErrorMessage(payload, response.status), response.status);
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

export async function registerUser(payload: {
  email: string;
  name: string;
  password: string;
}) {
  return request<AuthResponse>('/register', {
    body: payload,
    method: 'POST',
  });
}

export async function loginUser(payload: { email: string; password: string }) {
  return request<AuthResponse>('/login', {
    body: payload,
    method: 'POST',
  });
}

export async function logoutUser(token: string) {
  return request<{ message: string }>('/logout', {
    method: 'POST',
    token,
  });
}

export async function getCurrentUser(token: string) {
  return request<AuthUser>('/user', {
    token,
  });
}

export async function searchMovies(query: string, token: string) {
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
  );

  return payload.data;
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

export async function getWatchRooms(token: string) {
  const payload = await request<{ data: WatchRoomSummary[] }>('/watch-rooms', { token });
  return payload.data;
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

  return response.data;
}

export async function joinWatchRoom(code: string, token: string) {
  const response = await request<{ data: WatchRoom }>('/watch-rooms/join', {
    body: { code },
    method: 'POST',
    token,
  });

  return response.data;
}

export async function getWatchRoom(code: string, token: string) {
  const response = await request<{ data: WatchRoom }>(`/watch-rooms/${encodeURIComponent(code)}`, {
    token,
  });

  return response.data;
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

  return response.data;
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

  return response.data;
}

export async function getWatchRoomInvites(token: string) {
  return request<WatchRoomInvitesPayload>('/watch-room-invites', { token });
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

  return response.data;
}

export async function acceptWatchRoomInvite(inviteId: number, token: string) {
  const response = await request<{ data: WatchRoom }>(`/watch-room-invites/${inviteId}/accept`, {
    method: 'POST',
    token,
  });

  return response.data;
}

export async function rejectWatchRoomInvite(inviteId: number, token: string) {
  return request<{ message: string }>(`/watch-room-invites/${inviteId}/reject`, {
    method: 'POST',
    token,
  });
}

export { ApiConnectionError, ApiError };





