import { findBestJellyfinPlaybackMatch } from '@/lib/jellyfin';
import type { MediaType, MovieSearchResult } from '@/types/app';

type ResolveAutoVideoSourceInput = {
  mediaType: MediaType;
  releaseYear?: number | null;
  title: string;
};

function isValidUrl(value: string) {
  try {
    const parsedUrl = new URL(String(value || '').trim());
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
  } catch {
    return false;
  }
}

function getYouTubeVideoId(value: string) {
  if (!isValidUrl(value)) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);
    const hostname = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();

    if (hostname === 'youtu.be') {
      const candidate = parsedUrl.pathname.split('/').filter(Boolean)[0];
      return candidate || null;
    }

    if (hostname.endsWith('youtube.com')) {
      const directId = parsedUrl.searchParams.get('v');
      if (directId) {
        return directId;
      }

      const segments = parsedUrl.pathname.split('/').filter(Boolean);
      if (segments[0] === 'embed' && segments[1]) {
        return segments[1];
      }
    }

    return null;
  } catch {
    return null;
  }
}

function normalizeVideoUrl(value: string) {
  const trimmed = String(value || '').trim();
  const youtubeId = getYouTubeVideoId(trimmed);
  if (youtubeId) {
    return `https://www.youtube.com/watch?v=${youtubeId}`;
  }

  return trimmed;
}

function hashStringToNumber(value: string) {
  return value
    .split('')
    .reduce((accumulator, character) => (accumulator * 31 + character.charCodeAt(0)) >>> 0, 0);
}

function buildExternalVideoResult(query: string): MovieSearchResult[] {
  const trimmedQuery = String(query || '').trim();
  if (!isValidUrl(trimmedQuery)) {
    return [];
  }

  const normalizedUrl = normalizeVideoUrl(trimmedQuery);
  const youtubeId = getYouTubeVideoId(normalizedUrl);

  if (youtubeId) {
    return [
      {
        id: hashStringToNumber(youtubeId),
        mediaLabel: 'Видео',
        mediaType: 'movie',
        overview:
          'Источник добавлен по ссылке. Это видео с YouTube, а не встроенный каталог фильма или аниме.',
        posterPath: null,
        posterUrl: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
        rating: null,
        releaseYear: null,
        sourceKind: 'youtube',
        sourceLabel: 'YouTube',
        sourceProvider: 'YouTube',
        title: 'Видео YouTube',
        videoUrl: normalizedUrl,
      },
    ];
  }

  try {
    const parsedUrl = new URL(normalizedUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, '');
    const pathname = parsedUrl.pathname || '';
    const isDirectVideo = /\.(mp4|m3u8|webm|mov|m4v)(?:$|[?#])/i.test(pathname);

    return [
      {
        id: hashStringToNumber(normalizedUrl),
        mediaLabel: 'Видео',
        mediaType: 'movie',
        overview: isDirectVideo
          ? 'Прямая ссылка на видео. Такой источник можно открыть в комнате без поиска по названию.'
          : `Внешний источник по ссылке: ${hostname}.`,
        posterPath: null,
        posterUrl: null,
        rating: null,
        releaseYear: null,
        sourceKind: isDirectVideo ? 'direct' : 'external',
        sourceLabel: isDirectVideo ? 'Прямое видео' : 'Внешняя ссылка',
        sourceProvider: hostname,
        title: isDirectVideo ? 'Видео по ссылке' : hostname,
        videoUrl: normalizedUrl,
      },
    ];
  } catch {
    return [];
  }
}

export async function resolveAutoVideoSource(input: ResolveAutoVideoSourceInput) {
  const explicitResults = buildExternalVideoResult(input.title);
  if (explicitResults[0]?.videoUrl) {
    return explicitResults[0].videoUrl;
  }

  const jellyfinMatch = await findBestJellyfinPlaybackMatch(input).catch(() => null);
  return jellyfinMatch?.streamUrl ?? null;
}

export async function searchAutoVideoCatalog(query: string): Promise<MovieSearchResult[]> {
  return buildExternalVideoResult(query);
}
