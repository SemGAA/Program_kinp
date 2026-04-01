import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEFAULT_API_BASE_URL, sanitizeApiBaseUrl } from '@/lib/config';

const API_URL_KEY = 'cinema_app_api_base_url';
const REMOTE_BOOTSTRAP_URLS = [
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/main/mobile-bootstrap.json',
  'https://cdn.jsdelivr.net/gh/SemGAA/Program_kinp@main/mobile-bootstrap.json',
];
const EPHEMERAL_HOST_MARKERS = [
  'serveousercontent.com',
  'trycloudflare.com',
  'loca.lt',
  'localhost.run',
  'lhr.life',
  'ngrok-free.app',
];

let runtimeApiBaseUrl = DEFAULT_API_BASE_URL;

type RemoteBootstrapPayload = {
  apiBaseUrl?: string | null;
  lanApiBaseUrl?: string | null;
  publicApiBaseUrl?: string | null;
};

function webStorageAvailable() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

function extractHost(value: string) {
  return value.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0]?.split(':')[0]?.trim().toLowerCase() ?? '';
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function getStoredApiBaseUrl() {
  if (webStorageAvailable()) {
    return window.localStorage.getItem(API_URL_KEY);
  }

  return SecureStore.getItemAsync(API_URL_KEY);
}

async function setStoredApiBaseUrl(value: string) {
  if (webStorageAvailable()) {
    window.localStorage.setItem(API_URL_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(API_URL_KEY, value);
}

async function clearStoredApiBaseUrl() {
  if (webStorageAvailable()) {
    window.localStorage.removeItem(API_URL_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(API_URL_KEY);
}

export function getApiBaseUrl() {
  return runtimeApiBaseUrl;
}

export function isEphemeralApiBaseUrl(value: string) {
  const host = extractHost(value);

  return EPHEMERAL_HOST_MARKERS.some((marker) => host === marker || host.endsWith(`.${marker}`));
}

function collectBootstrapCandidates(payload: RemoteBootstrapPayload) {
  const candidates = [
    payload.lanApiBaseUrl,
    payload.apiBaseUrl,
    payload.publicApiBaseUrl,
  ];

  return candidates.reduce<string[]>((accumulator, candidate) => {
    const normalizedCandidate = typeof candidate === 'string' ? candidate.trim() : '';

    if (!normalizedCandidate || !isHttpUrl(normalizedCandidate)) {
      return accumulator;
    }

    const sanitizedCandidate = sanitizeApiBaseUrl(normalizedCandidate);

    if (!accumulator.includes(sanitizedCandidate)) {
      accumulator.push(sanitizedCandidate);
    }

    return accumulator;
  }, []);
}

async function fetchRemoteBootstrapPayload() {
  for (const bootstrapUrl of REMOTE_BOOTSTRAP_URLS) {
    const { clear, signal } = createTimeoutSignal(5000);

    try {
      const response = await fetch(`${bootstrapUrl}?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
        },
        signal,
      });

      if (!response.ok) {
        continue;
      }

      return (await response.json()) as RemoteBootstrapPayload;
    } catch {
      continue;
    } finally {
      clear();
    }
  }

  return null;
}

async function probeApiBaseUrl(apiBaseUrl: string) {
  const { clear, signal } = createTimeoutSignal(2500);

  try {
    const response = await fetch(`${apiBaseUrl}/ping?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clear();
  }
}

async function fetchRemoteApiBaseUrl() {
  const payload = await fetchRemoteBootstrapPayload();

  if (!payload) {
    return null;
  }

  const candidates = collectBootstrapCandidates(payload);

  if (!candidates.length) {
    return null;
  }

  for (const candidate of candidates) {
    if (await probeApiBaseUrl(candidate)) {
      return candidate;
    }
  }

  return candidates[0] ?? null;
}

function resolveInitialApiBaseUrl(storedValue: string | null, remoteValue: string | null) {
  const normalizedStoredValue = storedValue ? sanitizeApiBaseUrl(storedValue) : null;

  if (
    remoteValue &&
    (!normalizedStoredValue ||
      normalizedStoredValue === DEFAULT_API_BASE_URL ||
      isEphemeralApiBaseUrl(normalizedStoredValue))
  ) {
    return remoteValue;
  }

  if (normalizedStoredValue) {
    return normalizedStoredValue;
  }

  if (remoteValue) {
    return remoteValue;
  }

  return DEFAULT_API_BASE_URL;
}

export async function bootstrapApiBaseUrl() {
  const [storedValue, remoteValue] = await Promise.all([getStoredApiBaseUrl(), fetchRemoteApiBaseUrl()]);

  runtimeApiBaseUrl = resolveInitialApiBaseUrl(storedValue, remoteValue);

  if (storedValue !== runtimeApiBaseUrl) {
    await setStoredApiBaseUrl(runtimeApiBaseUrl);
  }

  return runtimeApiBaseUrl;
}

export async function refreshApiBaseUrl() {
  const remoteValue = await fetchRemoteApiBaseUrl();

  if (!remoteValue) {
    return runtimeApiBaseUrl;
  }

  const shouldAdoptRemote =
    runtimeApiBaseUrl === DEFAULT_API_BASE_URL ||
    runtimeApiBaseUrl === remoteValue ||
    isEphemeralApiBaseUrl(runtimeApiBaseUrl);

  if (!shouldAdoptRemote) {
    return runtimeApiBaseUrl;
  }

  runtimeApiBaseUrl = remoteValue;

  const storedValue = await getStoredApiBaseUrl();
  if (storedValue !== remoteValue) {
    await setStoredApiBaseUrl(remoteValue);
  }

  return runtimeApiBaseUrl;
}

export async function persistApiBaseUrl(value: string) {
  const normalized = sanitizeApiBaseUrl(value);
  runtimeApiBaseUrl = normalized;
  await setStoredApiBaseUrl(normalized);

  return normalized;
}

export async function resetApiBaseUrl() {
  await clearStoredApiBaseUrl();

  return bootstrapApiBaseUrl();
}
