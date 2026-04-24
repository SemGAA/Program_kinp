import { findBestJellyfinPlaybackMatch } from '@/lib/jellyfin';
import { CONFIGURED_EXTERNAL_STREAM_ENDPOINT } from '@/lib/stream-provider-config';
import { inspectPlaybackUrl, isAllowedPlaybackUrl } from '@/lib/video-source-policy';
import type { MediaType, MovieSearchResult } from '@/types/app';

export const EXTERNAL_STREAM_ENDPOINT = CONFIGURED_EXTERNAL_STREAM_ENDPOINT;

export type ResolveAutoVideoSourceInput = {
  mediaType: MediaType;
  releaseYear?: number | null;
  shikimoriId?: number | null;
  title: string;
  tmdbId?: number | null;
};

export type StreamProviderResult = {
  providerId: string;
  providerLabel: string;
  sourceKind: 'direct' | 'external';
  streamUrl: string;
  title: string;
};

export interface StreamProvider {
  id: string;
  isConfigured?: () => boolean | Promise<boolean>;
  label: string;
  resolve: (input: ResolveAutoVideoSourceInput) => Promise<StreamProviderResult | null>;
}

type ExternalProviderPayload = {
  data?: ExternalProviderStreamCandidate | null;
  result?: ExternalProviderStreamCandidate | null;
  stream?: ExternalProviderStreamCandidate | null;
  streams?: ExternalProviderStreamCandidate[] | null;
  title?: string | null;
  provider?: string | null;
  streamUrl?: string | null;
  url?: string | null;
};

type ExternalProviderStreamCandidate = {
  embedUrl?: string | null;
  kind?: 'direct' | 'external' | null;
  provider?: string | null;
  streamUrl?: string | null;
  title?: string | null;
  url?: string | null;
  videoUrl?: string | null;
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

function isDirectVideoUrl(value: string) {
  try {
    const parsedUrl = new URL(String(value || '').trim());
    return /\.(mp4|m3u8|webm|mov|m4v)(?:$|[?#])/i.test(parsedUrl.pathname || '');
  } catch {
    return false;
  }
}

function normalizeResolvedStream(
  value: StreamProviderResult | null | undefined,
  fallbackTitle: string,
): StreamProviderResult | null {
  if (!value?.streamUrl || !isAllowedPlaybackUrl(value.streamUrl)) {
    return null;
  }

  return {
    ...value,
    title: value.title || fallbackTitle,
  };
}

function pickExternalCandidate(payload: ExternalProviderPayload): ExternalProviderStreamCandidate | null {
  if (Array.isArray(payload.streams) && payload.streams.length > 0) {
    return payload.streams.find((item) => item.streamUrl || item.videoUrl || item.url || item.embedUrl) ?? null;
  }

  return payload.data ?? payload.result ?? payload.stream ?? payload;
}

function buildExternalProviderResult(
  input: ResolveAutoVideoSourceInput,
  candidate: ExternalProviderStreamCandidate | null,
): StreamProviderResult | null {
  const nextUrl = String(
    candidate?.streamUrl || candidate?.videoUrl || candidate?.url || candidate?.embedUrl || '',
  ).trim();

  if (!nextUrl) {
    return null;
  }

  const verdict = inspectPlaybackUrl(nextUrl);
  if (!verdict.allowed) {
    return null;
  }

  const sourceKind =
    candidate?.kind === 'direct' || candidate?.kind === 'external'
      ? candidate.kind
      : isDirectVideoUrl(nextUrl)
        ? 'direct'
        : 'external';

  return {
    providerId: 'external-provider',
    providerLabel: String(candidate?.provider || 'External Provider').trim() || 'External Provider',
    sourceKind,
    streamUrl: nextUrl,
    title: String(candidate?.title || input.title).trim() || input.title,
  };
}

function buildExternalVideoResult(query: string): MovieSearchResult[] {
  const trimmedQuery = String(query || '').trim();
  if (!isValidUrl(trimmedQuery)) {
    return [];
  }

  const normalizedUrl = normalizeVideoUrl(trimmedQuery);
  const policy = inspectPlaybackUrl(normalizedUrl);

  if (!policy.allowed) {
    return [
      {
        id: hashStringToNumber(`blocked:${normalizedUrl}`),
        mediaLabel: 'Источник заблокирован',
        mediaType: 'movie',
        overview:
          policy.reason ||
          'Этот источник не подходит для встроенного просмотра Cinema Notes.',
        posterPath: null,
        posterUrl: null,
        rating: null,
        releaseYear: null,
        sourceKind: 'external',
        sourceLabel: 'Заблокировано политикой источников',
        sourceProvider: 'Cinema Notes',
        title: 'Источник не подключён',
        videoUrl: null,
      },
    ];
  }

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
    const isDirectVideo = isDirectVideoUrl(normalizedUrl);

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

const jellyfinStreamProvider: StreamProvider = {
  id: 'jellyfin',
  label: 'Jellyfin',
  resolve: async (input) => {
    const jellyfinMatch = await findBestJellyfinPlaybackMatch(input).catch(() => null);

    return normalizeResolvedStream(
      jellyfinMatch
        ? {
            providerId: 'jellyfin',
            providerLabel: jellyfinMatch.sourceLabel,
            sourceKind: 'direct',
            streamUrl: jellyfinMatch.streamUrl,
            title: jellyfinMatch.title,
          }
        : null,
      input.title,
    );
  },
};

const externalStreamProvider: StreamProvider = {
  id: 'external-provider',
  isConfigured: () => Boolean(EXTERNAL_STREAM_ENDPOINT),
  label: 'External Provider',
  resolve: async (input) => {
    if (!EXTERNAL_STREAM_ENDPOINT) {
      return null;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(EXTERNAL_STREAM_ENDPOINT, {
        body: JSON.stringify(input),
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as ExternalProviderPayload;
      return buildExternalProviderResult(input, pickExternalCandidate(payload));
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  },
};

export const DEFAULT_STREAM_PROVIDERS: StreamProvider[] = [
  jellyfinStreamProvider,
  externalStreamProvider,
];

export async function resolveAutoVideoMatch(
  input: ResolveAutoVideoSourceInput,
  providers = DEFAULT_STREAM_PROVIDERS,
) {
  const explicitResults = buildExternalVideoResult(input.title);
  if (explicitResults[0]?.videoUrl && isAllowedPlaybackUrl(explicitResults[0].videoUrl)) {
    return {
      providerId: explicitResults[0].sourceKind || 'direct',
      providerLabel: explicitResults[0].sourceLabel || explicitResults[0].sourceProvider || 'Видео',
      sourceKind: explicitResults[0].sourceKind === 'direct' ? 'direct' : 'external',
      streamUrl: explicitResults[0].videoUrl,
      title: explicitResults[0].title,
    } satisfies StreamProviderResult;
  }

  for (const provider of providers) {
    const configured = provider.isConfigured ? await provider.isConfigured() : true;
    if (!configured) {
      continue;
    }

    const match = await provider.resolve(input);
    if (match) {
      return match;
    }
  }

  return null;
}

export async function resolveAutoVideoSource(input: ResolveAutoVideoSourceInput) {
  return (await resolveAutoVideoMatch(input))?.streamUrl ?? null;
}

export async function searchAutoVideoCatalog(query: string): Promise<MovieSearchResult[]> {
  return buildExternalVideoResult(query);
}
