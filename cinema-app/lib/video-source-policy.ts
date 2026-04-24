import { CONFIGURED_ALLOWED_PROVIDER_HOSTS } from '@/lib/stream-provider-config';

const FORBIDDEN_HOST_PARTS = [
  'kodik',
  'videocdn',
  'ashdi',
  'kinobox',
  'collaps',
  'alloha',
  'hdvb',
  'bazon',
  'voidboost',
  'filmix',
  'rezka',
  'anilibria',
  'animego',
];

const FORBIDDEN_PATH_PARTS = [
  '/iframe',
  '/embed',
  '/player',
  '/balancer',
  '/playlist',
  '/manifest',
];

const FORBIDDEN_QUERY_KEYS = ['iframe', 'player', 'balancer', 'bypass', 'referer', 'referrer'];

export const ALLOWED_PROVIDERS = [...CONFIGURED_ALLOWED_PROVIDER_HOSTS];

function hostMatchesProvider(host: string, providerHost: string) {
  return host === providerHost || host.endsWith(`.${providerHost}`);
}

export function isAllowedProviderHost(host: string) {
  const normalizedHost = String(host || '').trim().toLowerCase().replace(/^www\./, '');
  return ALLOWED_PROVIDERS.some((providerHost) => hostMatchesProvider(normalizedHost, providerHost));
}

export type VideoSourcePolicyVerdict = {
  allowed: boolean;
  reason: string | null;
};

export function inspectPlaybackUrl(value: string): VideoSourcePolicyVerdict {
  try {
    const parsedUrl = new URL(String(value || '').trim());
    const host = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
    const path = parsedUrl.pathname.toLowerCase();
    const queryKeys = [...parsedUrl.searchParams.keys()].map((key) => key.toLowerCase());

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return {
        allowed: false,
        reason: 'Разрешены только http/https ссылки.',
      };
    }

    if (FORBIDDEN_HOST_PARTS.some((part) => host.includes(part))) {
      return {
        allowed: false,
        reason:
          'Источник похож на сторонний видеобалансер. Cinema Notes не подключает такие плееры.',
      };
    }

    if (isAllowedProviderHost(host)) {
      return {
        allowed: true,
        reason: null,
      };
    }

    if (FORBIDDEN_PATH_PARTS.some((part) => path.includes(part))) {
      return {
        allowed: false,
        reason:
          'Ссылка похожа на iframe/player/balancer URL, а не на разрешённый видеофайл или личную медиатеку.',
      };
    }

    if (queryKeys.some((key) => FORBIDDEN_QUERY_KEYS.includes(key))) {
      return {
        allowed: false,
        reason:
          'Ссылка содержит параметры обхода или встраивания стороннего плеера.',
      };
    }

    return {
      allowed: true,
      reason: null,
    };
  } catch {
    return {
      allowed: false,
      reason: 'Ссылка не распознана как корректный URL.',
    };
  }
}

export function isAllowedPlaybackUrl(value: string) {
  return inspectPlaybackUrl(value).allowed;
}
