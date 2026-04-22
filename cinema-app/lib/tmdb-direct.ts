import Constants from 'expo-constants';

import type { MediaType, MovieDetails, MovieRecommendation, MovieSearchResult } from '@/types/app';

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const TMDB_CACHE_TTL_MS = 5 * 60 * 1000;
const TMDB_SEARCH_RESULTS_LIMIT = 16;
const TMDB_API_KEY_FALLBACK = 'c05cabab9351fafd2b28de9c14964ab4';

type TmdbMediaType = 'movie' | 'tv' | 'person';

type TmdbSummaryPayload = {
  backdrop_path?: string | null;
  first_air_date?: string | null;
  id: number;
  media_type?: TmdbMediaType;
  name?: string | null;
  overview?: string | null;
  poster_path?: string | null;
  release_date?: string | null;
  title?: string | null;
  vote_average?: number | null;
};

type TmdbDetailsPayload = TmdbSummaryPayload & {
  episode_run_time?: number[] | null;
  genres?: Array<{ id: number; name: string }>;
  number_of_episodes?: number | null;
  number_of_seasons?: number | null;
  runtime?: number | null;
};

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const searchCache = new Map<string, CacheEntry<MovieSearchResult[]>>();
const detailsCache = new Map<string, CacheEntry<MovieDetails>>();
const recommendationsCache = new Map<string, CacheEntry<MovieRecommendation[]>>();

function readExtraValue(key: 'tmdbApiKey' | 'tmdbReadAccessToken') {
  const extra = Constants.expoConfig?.extra as
    | {
        tmdbApiKey?: string;
        tmdbReadAccessToken?: string;
      }
    | undefined;

  const value = extra?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

const DIRECT_TMDB_API_KEY =
  process.env.EXPO_PUBLIC_TMDB_API_KEY?.trim() ||
  readExtraValue('tmdbApiKey') ||
  TMDB_API_KEY_FALLBACK;
const DIRECT_TMDB_READ_ACCESS_TOKEN =
  process.env.EXPO_PUBLIC_TMDB_READ_ACCESS_TOKEN?.trim() || readExtraValue('tmdbReadAccessToken');

function normalizeMediaType(mediaType?: string | null): MediaType {
  return mediaType === 'tv' ? 'tv' : 'movie';
}

function mediaLabel(mediaType: MediaType) {
  return mediaType === 'tv' ? 'Сериал' : 'Фильм';
}

function extractYear(date?: string | null) {
  if (!date) {
    return null;
  }

  const match = date.match(/^\d{4}/);
  return match ? Number(match[0]) : null;
}

function imageUrl(path?: string | null) {
  if (!path) {
    return null;
  }

  return `${TMDB_IMAGE_BASE_URL}/${String(path).replace(/^\/+/, '')}`;
}

function mapSummary(item: TmdbSummaryPayload): MovieSearchResult {
  const mediaType = normalizeMediaType(item.media_type);
  const releaseDate = mediaType === 'tv' ? item.first_air_date : item.release_date;

  return {
    id: item.id,
    mediaLabel: mediaLabel(mediaType),
    mediaType,
    overview: item.overview || '',
    posterPath: item.poster_path || null,
    posterUrl: imageUrl(item.poster_path),
    rating: typeof item.vote_average === 'number' ? item.vote_average : null,
    releaseYear: extractYear(releaseDate),
    sourceKind: 'catalog',
    sourceLabel: null,
    sourceProvider: null,
    title: item.title || item.name || 'Без названия',
  };
}

function mapDetails(item: TmdbDetailsPayload, requestedMediaType: MediaType): MovieDetails {
  const summary = mapSummary({
    ...item,
    media_type: requestedMediaType,
  });

  const runtime =
    requestedMediaType === 'tv'
      ? item.episode_run_time?.find((value) => Number.isFinite(value)) ?? null
      : item.runtime ?? null;

  return {
    ...summary,
    backdropPath: item.backdrop_path || null,
    backdropUrl: imageUrl(item.backdrop_path),
    episodeCount:
      requestedMediaType === 'tv' && Number.isFinite(item.number_of_episodes)
        ? Number(item.number_of_episodes)
        : null,
    genres: (item.genres ?? []).map((genre) => genre.name).filter(Boolean),
    runtime,
    seasonCount:
      requestedMediaType === 'tv' && Number.isFinite(item.number_of_seasons)
        ? Number(item.number_of_seasons)
        : null,
  };
}

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function writeCache<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T) {
  cache.set(key, {
    expiresAt: Date.now() + TMDB_CACHE_TTL_MS,
    value,
  });
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function hasDirectTmdbConfig() {
  return Boolean(DIRECT_TMDB_API_KEY || DIRECT_TMDB_READ_ACCESS_TOKEN);
}

async function tmdbRequest<T>(path: string, query: Record<string, string | number | boolean | null>) {
  if (!hasDirectTmdbConfig()) {
    throw new Error('TMDB direct client is not configured.');
  }

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  if (!DIRECT_TMDB_READ_ACCESS_TOKEN && DIRECT_TMDB_API_KEY) {
    params.set('api_key', DIRECT_TMDB_API_KEY);
  }

  const response = await fetchWithTimeout(`${TMDB_API_BASE_URL}/${path}?${params.toString()}`, {
    headers: {
      accept: 'application/json',
      ...(DIRECT_TMDB_READ_ACCESS_TOKEN
        ? { Authorization: `Bearer ${DIRECT_TMDB_READ_ACCESS_TOKEN}` }
        : null),
    },
  });

  if (!response.ok) {
    throw new Error(`TMDB request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function searchDirectTmdb(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const cached = readCache(searchCache, normalizedQuery);
  if (cached) {
    return cached;
  }

  const payload = await tmdbRequest<{ results?: TmdbSummaryPayload[] }>('search/multi', {
    include_adult: false,
    language: 'ru-RU',
    page: 1,
    query,
  });

  const results = (payload.results ?? [])
    .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    .map(mapSummary)
    .slice(0, TMDB_SEARCH_RESULTS_LIMIT);

  writeCache(searchCache, normalizedQuery, results);
  return results;
}

export async function getDirectMovieDetails(tmdbId: number, mediaType: MediaType) {
  const cacheKey = `${mediaType}:${tmdbId}`;
  const cached = readCache(detailsCache, cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await tmdbRequest<TmdbDetailsPayload>(`${mediaType}/${tmdbId}`, {
    language: 'ru-RU',
  });

  const details = mapDetails(payload, mediaType);
  writeCache(detailsCache, cacheKey, details);
  return details;
}

export async function getDirectMovieRecommendations(tmdbId: number, mediaType: MediaType) {
  const cacheKey = `${mediaType}:${tmdbId}`;
  const cached = readCache(recommendationsCache, cacheKey);
  if (cached) {
    return cached;
  }

  const payload = await tmdbRequest<{ results?: TmdbSummaryPayload[] }>(
    `${mediaType}/${tmdbId}/recommendations`,
    {
      language: 'ru-RU',
      page: 1,
    },
  );

  const recommendations = (payload.results ?? [])
    .map((item) =>
      mapSummary({
        ...item,
        media_type: mediaType,
      }),
    )
    .slice(0, TMDB_SEARCH_RESULTS_LIMIT) as MovieRecommendation[];

  writeCache(recommendationsCache, cacheKey, recommendations);
  return recommendations;
}
