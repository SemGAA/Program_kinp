import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEFAULT_API_BASE_URL, sanitizeApiBaseUrl } from '@/lib/config';

const API_URL_KEY = 'cinema_app_api_base_url';
const REMOTE_BOOTSTRAP_URL =
  'https://raw.githubusercontent.com/SemGAA/Program_kinp/main/mobile-bootstrap.json';
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

async function fetchRemoteApiBaseUrl() {
  try {
    const response = await fetch(`${REMOTE_BOOTSTRAP_URL}?ts=${Date.now()}`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RemoteBootstrapPayload;
    const nextValue = typeof payload.apiBaseUrl === 'string' ? payload.apiBaseUrl.trim() : '';

    if (!nextValue || !isHttpUrl(nextValue)) {
      return null;
    }

    return sanitizeApiBaseUrl(nextValue);
  } catch {
    return null;
  }
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
