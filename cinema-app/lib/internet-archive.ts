import type { MovieSearchResult } from '@/types/app';

const ARCHIVE_API_BASE_URL = 'https://archive.org';
const ARCHIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const ARCHIVE_METADATA_CONCURRENCY = 6;
const ARCHIVE_RESULTS_LIMIT = 10;

type ArchiveSearchDoc = {
  creator?: string | string[] | null;
  date?: string | null;
  description?: string | string[] | null;
  identifier?: string | null;
  licenseurl?: string | string[] | null;
  title?: string | string[] | null;
  year?: string | number | null;
};

type ArchiveSearchResponse = {
  response?: {
    docs?: ArchiveSearchDoc[];
  };
};

type ArchiveMetadataFile = {
  format?: string | null;
  name?: string | null;
  size?: string | number | null;
};

type ArchiveMetadataResponse = {
  files?: ArchiveMetadataFile[];
  metadata?: {
    description?: string | string[] | null;
    licenseurl?: string | string[] | null;
    title?: string | string[] | null;
  };
};

type CacheEntry = {
  expiresAt: number;
  value: MovieSearchResult[];
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
    expiresAt: Date.now() + ARCHIVE_CACHE_TTL_MS,
    value,
  });
}

function hashStringToNumber(value: string) {
  return String(value)
    .split('')
    .reduce((accumulator, character) => (accumulator * 31 + character.charCodeAt(0)) >>> 0, 0);
}

function normalizeTextValue(value: string | string[] | number | null | undefined) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  return String(value ?? '').trim();
}

function normalizeDescription(value: string | string[] | null | undefined) {
  const text = normalizeTextValue(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text.length > 360 ? `${text.slice(0, 357).trim()}...` : text;
}

function extractYear(doc: ArchiveSearchDoc) {
  const fromYear = Number(doc.year);
  if (Number.isFinite(fromYear) && fromYear > 1800) {
    return fromYear;
  }

  const match = String(doc.date || '').match(/\b(18|19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function isProbablyPlayableFile(file: ArchiveMetadataFile) {
  const name = String(file.name || '').toLowerCase();
  const format = String(file.format || '').toLowerCase();

  if (!name || /(_thumb|_files\.xml|_meta\.xml|_archive\.torrent|\.gif$|\.jpg$|\.png$)/i.test(name)) {
    return false;
  }

  return (
    /\.(mp4|m4v|webm)$/i.test(name) ||
    format.includes('h.264') ||
    format.includes('mpeg4') ||
    format.includes('matroska') ||
    format.includes('webm')
  );
}

function fileScore(file: ArchiveMetadataFile) {
  const name = String(file.name || '').toLowerCase();
  const format = String(file.format || '').toLowerCase();
  let score = 0;

  if (name.endsWith('.mp4')) {
    score += 80;
  }

  if (format.includes('h.264') || format.includes('mpeg4')) {
    score += 60;
  }

  if (name.endsWith('.webm')) {
    score += 35;
  }

  if (name.includes('512kb')) {
    score -= 30;
  }

  if (name.includes('thumb') || name.includes('sample')) {
    score -= 80;
  }

  const size = Number(file.size);
  if (Number.isFinite(size)) {
    score += Math.min(30, Math.floor(size / (100 * 1024 * 1024)));
  }

  return score;
}

function encodeArchiveFilePath(name: string) {
  return name
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildFileUrl(identifier: string, fileName: string) {
  return `${ARCHIVE_API_BASE_URL}/download/${encodeURIComponent(identifier)}/${encodeArchiveFilePath(fileName)}`;
}

function buildSearchUrl(query: string) {
  const params = new URLSearchParams();
  const escapedQuery = query.trim().replace(/"/g, '');

  params.set(
    'q',
    [
      'mediatype:movies',
      `(${escapedQuery})`,
      'licenseurl:*',
      '-collection:test_videos',
      '-collection:gamevideos',
    ].join(' AND '),
  );
  params.append('fl[]', 'identifier');
  params.append('fl[]', 'title');
  params.append('fl[]', 'description');
  params.append('fl[]', 'date');
  params.append('fl[]', 'year');
  params.append('fl[]', 'creator');
  params.append('fl[]', 'licenseurl');
  params.set('rows', String(ARCHIVE_RESULTS_LIMIT));
  params.set('page', '1');
  params.set('output', 'json');
  params.set('sort[]', 'downloads desc');

  return `${ARCHIVE_API_BASE_URL}/advancedsearch.php?${params.toString()}`;
}

async function fetchJsonWithTimeout<T>(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Cinema Notes',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Internet Archive request failed with status ${response.status}.`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveArchivePlayback(doc: ArchiveSearchDoc): Promise<MovieSearchResult | null> {
  const identifier = String(doc.identifier || '').trim();
  const title = normalizeTextValue(doc.title) || identifier;
  if (!identifier || !title) {
    return null;
  }

  const metadata = await fetchJsonWithTimeout<ArchiveMetadataResponse>(
    `${ARCHIVE_API_BASE_URL}/metadata/${encodeURIComponent(identifier)}`,
  );

  const file = (metadata.files ?? [])
    .filter(isProbablyPlayableFile)
    .sort((left, right) => fileScore(right) - fileScore(left))[0];

  const fileName = String(file?.name || '').trim();
  if (!fileName) {
    return null;
  }

  const license = normalizeTextValue(metadata.metadata?.licenseurl || doc.licenseurl);
  const description =
    normalizeDescription(metadata.metadata?.description || doc.description) ||
    'Легальный видеоматериал из Internet Archive. Его можно открыть прямо во встроенном плеере Cinema Notes.';

  return {
    id: hashStringToNumber(`archive:${identifier}`),
    mediaLabel: 'Легальное видео',
    mediaType: 'movie',
    overview: [
      description,
      license ? `Лицензия: ${license}` : null,
      'Источник: Internet Archive.',
    ]
      .filter(Boolean)
      .join(' '),
    posterPath: null,
    posterUrl: `${ARCHIVE_API_BASE_URL}/services/img/${encodeURIComponent(identifier)}`,
    rating: null,
    releaseYear: extractYear(doc),
    sourceKind: 'internet_archive',
    sourceLabel: 'Internet Archive · легально',
    sourceProvider: 'Internet Archive',
    title,
    videoUrl: buildFileUrl(identifier, fileName),
  };
}

export async function searchInternetArchiveVideos(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length < 2) {
    return [];
  }

  const cached = readCache(normalizedQuery);
  if (cached) {
    return cached;
  }

  const searchPayload = await fetchJsonWithTimeout<ArchiveSearchResponse>(buildSearchUrl(query));
  const docs = (searchPayload.response?.docs ?? []).slice(0, ARCHIVE_METADATA_CONCURRENCY);

  const results = (
    await Promise.all(docs.map((doc) => resolveArchivePlayback(doc).catch(() => null)))
  ).filter((item): item is MovieSearchResult => Boolean(item));

  writeCache(normalizedQuery, results);
  return results;
}
