import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { MediaType, MovieSearchResult } from '@/types/app';

const JELLYFIN_CONNECTION_KEY = 'cinema_app_jellyfin_connection';
const DEVICE_ID = 'cinema-notes-mobile';
const CLIENT_NAME = 'Cinema Notes';
const APP_VERSION = '1.5.9';
const REQUEST_TIMEOUT_MS = 15000;

type JellyfinStoredConnection = {
  accessToken: string;
  connectedAt: string;
  serverUrl: string;
  userId: string;
  username: string;
};

type JellyfinAuthResponse = {
  AccessToken?: string | null;
  User?: {
    Id?: string | null;
    Name?: string | null;
  } | null;
};

type JellyfinItemType = 'Movie' | 'Series' | 'Episode' | 'Season' | 'Video';
type JellyfinPlayableItemType = Exclude<JellyfinItemType, 'Season'>;

type JellyfinMediaSource = {
  Id?: string | null;
};

type JellyfinItem = {
  ChildCount?: number | null;
  CommunityRating?: number | null;
  Id?: string | null;
  ImageTags?: {
    Primary?: string | null;
  } | null;
  IndexNumber?: number | null;
  MediaSources?: JellyfinMediaSource[] | null;
  Name?: string | null;
  Overview?: string | null;
  ParentIndexNumber?: number | null;
  ProductionYear?: number | null;
  RecursiveItemCount?: number | null;
  SeasonId?: string | null;
  SeasonName?: string | null;
  SeriesId?: string | null;
  SeriesName?: string | null;
  Type?: JellyfinItemType | string | null;
};

type JellyfinItemsResponse = {
  Items?: JellyfinItem[] | null;
};

export type JellyfinConnection = JellyfinStoredConnection;

export type JellyfinResolvedStream = {
  itemId: string;
  itemType: JellyfinItemType;
  sourceLabel: string;
  streamUrl: string;
  title: string;
};

type ResolvePlaybackInput = {
  itemId: string;
  itemType?: string | null;
  title: string;
};

type SearchMatchInput = {
  mediaType: MediaType;
  releaseYear?: number | null;
  title: string;
};

function storageAvailableOnWeb() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

function normalizeServerUrl(value: string) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function buildAuthorizationHeader(token?: string | null) {
  const parts = [`Client="${CLIENT_NAME}"`, 'Device="Android"', `DeviceId="${DEVICE_ID}"`, `Version="${APP_VERSION}"`];

  if (token) {
    parts.unshift(`Token="${token}"`);
  }

  return `MediaBrowser ${parts.join(', ')}`;
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    clear: () => clearTimeout(timeoutId),
    signal: controller.signal,
  };
}

function hashStringToNumber(value: string) {
  return String(value)
    .split('')
    .reduce((accumulator, character) => (accumulator * 31 + character.charCodeAt(0)) >>> 0, 0);
}

function normalizeText(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function mediaLabel(mediaType: MediaType) {
  return mediaType === 'tv' ? 'Сериал' : 'Фильм';
}

function itemMediaType(itemType?: string | null): MediaType {
  return itemType === 'Series' || itemType === 'Episode' || itemType === 'Season' ? 'tv' : 'movie';
}

function buildImageUrl(connection: JellyfinStoredConnection, item: JellyfinItem) {
  const itemId = item.Id?.trim();
  if (!itemId) {
    return null;
  }

  const params = new URLSearchParams({
    api_key: connection.accessToken,
    quality: '90',
  });

  const tag = item.ImageTags?.Primary?.trim();
  if (tag) {
    params.set('tag', tag);
  }

  return `${connection.serverUrl}/Items/${encodeURIComponent(itemId)}/Images/Primary?${params.toString()}`;
}

function buildStreamUrl(connection: JellyfinStoredConnection, itemId: string, mediaSourceId?: string | null) {
  const params = new URLSearchParams({
    api_key: connection.accessToken,
    audioCodec: 'aac',
    deviceId: DEVICE_ID,
    transcodingContainer: 'ts',
    videoCodec: 'h264',
  });

  if (mediaSourceId) {
    params.set('mediaSourceId', mediaSourceId);
  }

  return `${connection.serverUrl}/Videos/${encodeURIComponent(itemId)}/main.m3u8?${params.toString()}`;
}

function buildMovieSearchResult(
  item: JellyfinItem,
  connection: JellyfinStoredConnection,
): MovieSearchResult | null {
  const itemId = item.Id?.trim();
  const itemType = item.Type?.trim() as JellyfinItemType | undefined;
  const title = item.Name?.trim();

  if (!itemId || !itemType || !title) {
    return null;
  }

  const playableDirect =
    itemType === 'Movie' || itemType === 'Video' || itemType === 'Episode'
      ? buildStreamUrl(connection, itemId, item.MediaSources?.[0]?.Id ?? null)
      : null;

  return {
    id: hashStringToNumber(`jellyfin:${itemId}`),
    jellyfinItemId: itemId,
    jellyfinItemType: (itemType === 'Season' ? 'Series' : itemType) as JellyfinPlayableItemType,
    mediaLabel: mediaLabel(itemMediaType(itemType)),
    mediaType: itemMediaType(itemType),
    overview: item.Overview?.trim() || 'Найдено в вашей библиотеке Jellyfin.',
    posterPath: null,
    posterUrl: buildImageUrl(connection, item),
    rating: typeof item.CommunityRating === 'number' ? item.CommunityRating : null,
    releaseYear: typeof item.ProductionYear === 'number' ? item.ProductionYear : null,
    seasonCount:
      itemType === 'Series' && typeof item.ChildCount === 'number' ? Math.max(1, item.ChildCount) : null,
    sourceKind: 'jellyfin',
    sourceLabel: itemType === 'Series' ? 'Jellyfin • сериал' : 'Jellyfin • библиотека',
    sourceProvider: 'Jellyfin',
    title:
      itemType === 'Episode' && item.SeriesName
        ? `${item.SeriesName} • ${item.ParentIndexNumber ?? 1}x${item.IndexNumber ?? 1}`
        : title,
    videoUrl: playableDirect,
  };
}

async function readStoredConnection() {
  if (storageAvailableOnWeb()) {
    return window.localStorage.getItem(JELLYFIN_CONNECTION_KEY);
  }

  return SecureStore.getItemAsync(JELLYFIN_CONNECTION_KEY);
}

async function writeStoredConnection(value: string) {
  if (storageAvailableOnWeb()) {
    window.localStorage.setItem(JELLYFIN_CONNECTION_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(JELLYFIN_CONNECTION_KEY, value);
}

async function clearStoredConnection() {
  if (storageAvailableOnWeb()) {
    window.localStorage.removeItem(JELLYFIN_CONNECTION_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(JELLYFIN_CONNECTION_KEY);
}

async function jellyfinRequest<T>(
  path: string,
  options: {
    body?: unknown;
    connection?: JellyfinStoredConnection | null;
    headers?: Record<string, string>;
    method?: 'GET' | 'POST';
    query?: Record<string, string | number | boolean | null | undefined>;
    serverUrl?: string;
  },
) {
  const serverUrl = normalizeServerUrl(options.serverUrl || options.connection?.serverUrl || '');
  if (!serverUrl) {
    throw new Error('Укажите адрес сервера Jellyfin.');
  }

  const params = new URLSearchParams();
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  const url = `${serverUrl}${path}${params.size ? `?${params.toString()}` : ''}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : null),
    ...(options.connection
      ? {
          Authorization: buildAuthorizationHeader(options.connection.accessToken),
          'X-Emby-Token': options.connection.accessToken,
        }
      : null),
    ...(options.headers ?? {}),
  };

  const { clear, signal } = createTimeoutSignal(REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      headers,
      method: options.method ?? 'GET',
      signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Jellyfin отклонил доступ. Проверьте адрес сервера, логин и пароль.');
      }

      throw new Error(`Jellyfin вернул ошибку ${response.status}.`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Jellyfin не ответил вовремя. Проверьте адрес сервера и соединение.');
    }

    throw error;
  } finally {
    clear();
  }
}

async function getSeriesSeasons(connection: JellyfinStoredConnection, seriesId: string) {
  const payload = await jellyfinRequest<JellyfinItemsResponse>(`/Shows/${encodeURIComponent(seriesId)}/Seasons`, {
    connection,
    query: {
      userId: connection.userId,
    },
  });

  return (payload.Items ?? [])
    .filter((item) => item.Id && item.Type === 'Season')
    .sort((left, right) => Number(left.IndexNumber ?? 999) - Number(right.IndexNumber ?? 999));
}

async function getSeasonEpisodes(connection: JellyfinStoredConnection, seriesId: string, seasonId: string) {
  const payload = await jellyfinRequest<JellyfinItemsResponse>(`/Shows/${encodeURIComponent(seriesId)}/Episodes`, {
    connection,
    query: {
      fields: 'MediaSources',
      limit: 200,
      seasonId,
      sortBy: 'SortName',
      sortOrder: 'Ascending',
      userId: connection.userId,
    },
  });

  return (payload.Items ?? [])
    .filter((item) => item.Id && item.Type === 'Episode')
    .sort((left, right) => Number(left.IndexNumber ?? 999) - Number(right.IndexNumber ?? 999));
}

async function getItemWithMediaSources(connection: JellyfinStoredConnection, itemId: string) {
  return jellyfinRequest<JellyfinItem>(`/Users/${encodeURIComponent(connection.userId)}/Items/${encodeURIComponent(itemId)}`, {
    connection,
    query: {
      fields: 'MediaSources',
    },
  });
}

async function resolvePlaybackFromItem(
  connection: JellyfinStoredConnection,
  input: ResolvePlaybackInput,
): Promise<JellyfinResolvedStream | null> {
  const itemType = (input.itemType?.trim() || '') as JellyfinItemType | '';

  if (itemType === 'Series') {
    const seasons = await getSeriesSeasons(connection, input.itemId);
    const firstSeason = seasons.find((item) => Number(item.IndexNumber ?? 0) > 0) ?? seasons[0];

    if (!firstSeason?.Id) {
      return null;
    }

    const episodes = await getSeasonEpisodes(connection, input.itemId, firstSeason.Id);
    const firstEpisode = episodes[0];

    if (!firstEpisode?.Id) {
      return null;
    }

    return {
      itemId: firstEpisode.Id,
      itemType: 'Episode',
      sourceLabel: 'Jellyfin',
      streamUrl: buildStreamUrl(connection, firstEpisode.Id, firstEpisode.MediaSources?.[0]?.Id ?? null),
      title:
        firstEpisode.Name && Number.isFinite(firstEpisode.IndexNumber)
          ? `${input.title} • ${Number(firstSeason.IndexNumber ?? 1)} сезон, ${Number(firstEpisode.IndexNumber)} серия`
          : `${input.title} • первая серия`,
    };
  }

  const item = await getItemWithMediaSources(connection, input.itemId);
  if (!item.Id) {
    return null;
  }

  return {
    itemId: item.Id,
    itemType: (item.Type?.trim() || itemType || 'Video') as JellyfinItemType,
    sourceLabel: 'Jellyfin',
    streamUrl: buildStreamUrl(connection, item.Id, item.MediaSources?.[0]?.Id ?? null),
    title: input.title,
  };
}

function buildScore(item: JellyfinItem, query: SearchMatchInput) {
  const itemTitle = normalizeText(item.Name || item.SeriesName || '');
  const queryTitle = normalizeText(query.title);
  const itemType = item.Type || '';
  const itemYear = Number(item.ProductionYear ?? 0) || null;

  let score = 0;

  if (!itemTitle) {
    return score;
  }

  if (itemTitle === queryTitle) {
    score += 120;
  } else if (itemTitle.startsWith(queryTitle)) {
    score += 80;
  } else if (itemTitle.includes(queryTitle)) {
    score += 50;
  }

  if (query.mediaType === 'tv' && itemType === 'Series') {
    score += 40;
  }

  if (query.mediaType === 'movie' && (itemType === 'Movie' || itemType === 'Video')) {
    score += 40;
  }

  if (query.releaseYear && itemYear) {
    if (query.releaseYear === itemYear) {
      score += 25;
    } else if (Math.abs(query.releaseYear - itemYear) <= 1) {
      score += 12;
    }
  }

  return score;
}

export async function getStoredJellyfinConnection(): Promise<JellyfinConnection | null> {
  const rawValue = await readStoredConnection();

  if (!rawValue) {
    return null;
  }

  try {
    const parsedValue = JSON.parse(rawValue) as JellyfinStoredConnection;

    if (!parsedValue.accessToken || !parsedValue.serverUrl || !parsedValue.userId) {
      return null;
    }

    return {
      accessToken: parsedValue.accessToken,
      connectedAt: parsedValue.connectedAt || new Date().toISOString(),
      serverUrl: normalizeServerUrl(parsedValue.serverUrl),
      userId: parsedValue.userId,
      username: parsedValue.username || 'Jellyfin',
    };
  } catch {
    return null;
  }
}

export async function disconnectJellyfin() {
  await clearStoredConnection();
}

export async function connectJellyfin(payload: {
  password: string;
  serverUrl: string;
  username: string;
}) {
  const serverUrl = normalizeServerUrl(payload.serverUrl);
  const username = String(payload.username || '').trim();
  const password = String(payload.password || '');

  if (!serverUrl) {
    throw new Error('Укажите адрес сервера Jellyfin.');
  }

  if (!username || !password) {
    throw new Error('Укажите логин и пароль от Jellyfin.');
  }

  const response = await jellyfinRequest<JellyfinAuthResponse>('/Users/AuthenticateByName', {
    body: {
      Pw: password,
      Username: username,
    },
    headers: {
      Authorization: buildAuthorizationHeader(),
    },
    method: 'POST',
    serverUrl,
  });

  const accessToken = response.AccessToken?.trim();
  const userId = response.User?.Id?.trim();
  const displayName = response.User?.Name?.trim() || username;

  if (!accessToken || !userId) {
    throw new Error('Jellyfin не вернул токен доступа.');
  }

  const connection: JellyfinStoredConnection = {
    accessToken,
    connectedAt: new Date().toISOString(),
    serverUrl,
    userId,
    username: displayName,
  };

  await writeStoredConnection(JSON.stringify(connection));
  return connection;
}

export async function verifyJellyfinConnection() {
  const connection = await getStoredJellyfinConnection();
  if (!connection) {
    return null;
  }

  const payload = await jellyfinRequest<{ Id?: string | null; Name?: string | null }>('/Users/Me', {
    connection,
  });

  return {
    ...connection,
    username: payload.Name?.trim() || connection.username,
  };
}

export async function searchJellyfinCatalog(query: string): Promise<MovieSearchResult[]> {
  const connection = await getStoredJellyfinConnection();
  const trimmedQuery = String(query || '').trim();

  if (!connection || trimmedQuery.length < 2) {
    return [];
  }

  const payload = await jellyfinRequest<JellyfinItemsResponse>(`/Users/${encodeURIComponent(connection.userId)}/Items`, {
    connection,
    query: {
      fields: 'MediaSources',
      imageTypeLimit: 1,
      includeItemTypes: 'Movie,Series,Video',
      limit: 12,
      recursive: true,
      searchTerm: trimmedQuery,
      sortBy: 'SortName',
      sortOrder: 'Ascending',
    },
  });

  return (payload.Items ?? [])
    .map((item) => buildMovieSearchResult(item, connection))
    .filter(Boolean) as MovieSearchResult[];
}

export async function resolveJellyfinPlaybackForResult(movie: MovieSearchResult) {
  const connection = await getStoredJellyfinConnection();

  if (!connection || !movie.jellyfinItemId) {
    return null;
  }

  if (movie.videoUrl) {
    return {
      itemId: movie.jellyfinItemId,
      itemType: (movie.jellyfinItemType || 'Video') as JellyfinItemType,
      sourceLabel: 'Jellyfin',
      streamUrl: movie.videoUrl,
      title: movie.title,
    } satisfies JellyfinResolvedStream;
  }

  return resolvePlaybackFromItem(connection, {
    itemId: movie.jellyfinItemId,
    itemType: movie.jellyfinItemType,
    title: movie.title,
  });
}

export async function findBestJellyfinPlaybackMatch(input: SearchMatchInput) {
  const connection = await getStoredJellyfinConnection();
  if (!connection) {
    return null;
  }

  const payload = await jellyfinRequest<JellyfinItemsResponse>(`/Users/${encodeURIComponent(connection.userId)}/Items`, {
    connection,
    query: {
      includeItemTypes: input.mediaType === 'tv' ? 'Series' : 'Movie,Video',
      limit: 10,
      recursive: true,
      searchTerm: input.title,
      sortBy: 'SortName',
      sortOrder: 'Ascending',
    },
  });

  const items = (payload.Items ?? []).filter((item) => item.Id && item.Name);
  const bestItem = [...items].sort((left, right) => buildScore(right, input) - buildScore(left, input))[0];

  if (!bestItem?.Id || buildScore(bestItem, input) < 50) {
    return null;
  }

  return resolvePlaybackFromItem(connection, {
    itemId: bestItem.Id,
    itemType: bestItem.Type,
    title: bestItem.Name || input.title,
  });
}
