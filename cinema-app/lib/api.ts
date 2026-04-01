import { getApiBaseUrl } from '@/lib/runtime-config';
import type {
  AuthResponse,
  AuthUser,
  Friend,
  FriendRequest,
  FriendRequestsPayload,
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

  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
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
    method: 'POST',
    body: payload,
  });
}

export async function loginUser(payload: { email: string; password: string }) {
  return request<AuthResponse>('/login', {
    method: 'POST',
    body: payload,
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
  const payload = await request<{ data: MovieSearchResult[] }>(
    `/movies/search?q=${encodeURIComponent(query)}`,
    { token },
  );

  return payload.data;
}

export async function getMovieDetails(tmdbId: number, token: string) {
  const payload = await request<{ data: MovieDetails }>(`/movies/${tmdbId}`, { token });
  return payload.data;
}

export async function getMovieRecommendations(tmdbId: number, note: string, token: string) {
  const query = note ? `?note=${encodeURIComponent(note)}` : '';
  const payload = await request<{ data: MovieRecommendation[] }>(
    `/movies/${tmdbId}/recommendations${query}`,
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
    poster_path?: string | null;
    release_year?: number | null;
    tmdb_id: number;
  },
  token: string,
) {
  const response = await request<{ data: MovieNote }>('/notes', {
    method: 'POST',
    body: payload,
    token,
  });

  return response.data;
}

export async function updateNote(noteId: number, noteText: string, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}`, {
    method: 'PATCH',
    body: { note_text: noteText },
    token,
  });

  return response.data;
}

export async function shareNote(noteId: number, recipientId: number, token: string) {
  const response = await request<{ data: MovieNote }>(`/notes/${noteId}/share`, {
    method: 'POST',
    body: { recipient_id: recipientId },
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
    method: 'POST',
    body: { email },
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
    poster_path?: string | null;
    release_year?: number | null;
    tmdb_id?: number | null;
    video_url: string;
  },
  token: string,
) {
  const response = await request<{ data: WatchRoom }>('/watch-rooms', {
    method: 'POST',
    body: payload,
    token,
  });

  return response.data;
}

export async function joinWatchRoom(code: string, token: string) {
  const response = await request<{ data: WatchRoom }>('/watch-rooms/join', {
    method: 'POST',
    body: { code },
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
      method: 'POST',
      body: payload,
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
      method: 'POST',
      body: payload,
      token,
    },
  );

  return response.data;
}

export { ApiConnectionError, ApiError };
