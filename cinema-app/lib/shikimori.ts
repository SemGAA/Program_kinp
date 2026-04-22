import type { MovieSearchResult } from '@/types/app';

const SHIKIMORI_API_BASE_URL = 'https://shikimori.one/api';
const SHIKIMORI_IMAGE_BASE_URL = 'https://shikimori.one';
const SHIKIMORI_CACHE_TTL_MS = 5 * 60 * 1000;
const SHIKIMORI_RESULTS_LIMIT = 12;

type CacheEntry = {
  expiresAt: number;
  value: MovieSearchResult[];
};

type ShikimoriAnime = {
  aired_on?: string | null;
  episodes?: number | null;
  id?: number | null;
  image?: {
    original?: string | null;
    preview?: string | null;
  } | null;
  kind?: string | null;
  name?: string | null;
  released_on?: string | null;
  russian?: string | null;
  score?: string | null;
  status?: string | null;
  url?: string | null;
};

const searchCache = new Map<string, CacheEntry>();

function readCache(key: string) {
  const cached = searchCache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(key);
    return null;
  }

  return cached.value;
}

function writeCache(key: string, value: MovieSearchResult[]) {
  searchCache.set(key, {
    expiresAt: Date.now() + SHIKIMORI_CACHE_TTL_MS,
    value,
  });
}

function hashStringToNumber(value: string) {
  return String(value)
    .split('')
    .reduce((accumulator, character) => (accumulator * 31 + character.charCodeAt(0)) >>> 0, 0);
}

function extractYear(value?: string | null) {
  const match = String(value || '').match(/^\d{4}/);
  return match ? Number(match[0]) : null;
}

function buildImageUrl(path?: string | null) {
  const trimmedPath = String(path || '').trim();
  if (!trimmedPath) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmedPath)) {
    return trimmedPath;
  }

  return `${SHIKIMORI_IMAGE_BASE_URL}${trimmedPath.startsWith('/') ? '' : '/'}${trimmedPath}`;
}

function normalizeKind(kind?: string | null) {
  const normalizedKind = String(kind || '').toLowerCase();
  return normalizedKind === 'movie' ? 'movie' : 'tv';
}

function mapAnimeKind(kind?: string | null) {
  const normalizedKind = String(kind || '').toLowerCase();

  const labels: Record<string, string> = {
    movie: 'Аниме-фильм',
    music: 'Клип',
    ona: 'ONA',
    ova: 'OVA',
    special: 'Спешл',
    tv: 'Аниме-сериал',
    tv_13: 'Аниме-сериал',
    tv_24: 'Аниме-сериал',
    tv_48: 'Аниме-сериал',
  };

  return labels[normalizedKind] ?? 'Аниме';
}

function mapShikimoriAnime(item: ShikimoriAnime): MovieSearchResult | null {
  const shikimoriId = Number(item.id);
  const title = String(item.russian || item.name || '').trim();

  if (!Number.isFinite(shikimoriId) || !title) {
    return null;
  }

  const episodes = Number(item.episodes);
  const rating = Number(item.score);
  const mediaType = normalizeKind(item.kind);
  const originalTitle = String(item.name || '').trim();
  const status = String(item.status || '').trim();

  return {
    episodeCount: Number.isFinite(episodes) && episodes > 0 ? episodes : null,
    id: hashStringToNumber(`shikimori:${shikimoriId}`),
    mediaLabel: mapAnimeKind(item.kind),
    mediaType,
    overview: [
      originalTitle && originalTitle !== title ? `Оригинальное название: ${originalTitle}.` : null,
      status ? `Статус: ${status}.` : null,
      'Карточка найдена в Shikimori. Для просмотра без ручной ссылки подключите Jellyfin с этим тайтлом в библиотеке.',
    ]
      .filter(Boolean)
      .join(' '),
    posterPath: null,
    posterUrl: buildImageUrl(item.image?.original || item.image?.preview),
    rating: Number.isFinite(rating) && rating > 0 ? rating : null,
    releaseYear: extractYear(item.aired_on || item.released_on),
    seasonCount: mediaType === 'tv' ? 1 : null,
    shikimoriId,
    sourceKind: 'shikimori',
    sourceLabel: 'Shikimori · аниме',
    sourceProvider: 'Shikimori',
    title,
  };
}

async function fetchWithTimeout(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    return await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Cinema Notes',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchShikimoriAnime(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const cached = readCache(normalizedQuery);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    limit: String(SHIKIMORI_RESULTS_LIMIT),
    order: 'popularity',
    search: query.trim(),
  });

  const response = await fetchWithTimeout(`${SHIKIMORI_API_BASE_URL}/animes?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Shikimori search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as ShikimoriAnime[];
  const results = (Array.isArray(payload) ? payload : [])
    .map(mapShikimoriAnime)
    .filter((item): item is MovieSearchResult => Boolean(item));

  writeCache(normalizedQuery, results);
  return results;
}
