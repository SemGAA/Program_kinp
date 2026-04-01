import { getApiBaseUrl, refreshApiBaseUrl } from '@/lib/runtime-config';
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
  WatchRoomMessage,
  WatchRoomSummary,
} from '@/types/app';

type RequestOptions = {
  body?: unknown;
  method?: 'GET' | 'POST' | 'PATCH';
  token?: string | null;
};

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

  const executeFetch = (baseUrl: string) =>
    fetch(`${baseUrl}${path}`, {
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      headers,
      method: options.method ?? 'GET',
    });

  const initialBaseUrl = getApiBaseUrl();
  let response: Response | null = null;

  try {
    response = await executeFetch(initialBaseUrl);
  } catch {
    response = null;
  }

  if (!response || response.status >= 500) {
    const refreshedBaseUrl = await refreshApiBaseUrl();

    if (refreshedBaseUrl !== initialBaseUrl) {
      try {
        response = await executeFetch(refreshedBaseUrl);
      } catch {
        if (!response) {
          throw new ApiConnectionError(
            'Не удалось подключиться к backend API. Проверьте адрес сервера и доступность сети.',
          );
        }
      }
    }
  }

  if (!response) {
    throw new ApiConnectionError(
      'Не удалось подключиться к backend API. Проверьте адрес сервера и доступность сети.',
    );
  }

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(extractErrorMessage(payload, response.status), response.status);
  }

  return payload as T;
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
  return request<NotesPayload>('/notes', { token });
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

  return response.data;
}

export async function updateNote(noteId: number, noteText: string, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}`, {
    body: { note_text: noteText },
    method: 'PATCH',
    token,
  });

  return response.data;
}

export async function shareNote(noteId: number, recipientId: number, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}/share`, {
    body: { recipient_id: recipientId },
    method: 'POST',
    token,
  });

  return response.data;
}

export async function acceptNote(noteId: number, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}/accept`, {
    method: 'POST',
    token,
  });

  return response.data;
}

export async function rejectNote(noteId: number, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}/reject`, {
    method: 'POST',
    token,
  });

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
    video_url: string;
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

export { ApiConnectionError, ApiError };
