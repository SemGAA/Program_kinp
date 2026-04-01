import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { DEFAULT_API_BASE_URL, sanitizeApiBaseUrl } from '@/lib/config';

const API_URL_KEY = 'cinema_app_api_base_url';

let runtimeApiBaseUrl = DEFAULT_API_BASE_URL;

function webStorageAvailable() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
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

export async function bootstrapApiBaseUrl() {
  const storedValue = await getStoredApiBaseUrl();

  runtimeApiBaseUrl = storedValue ? sanitizeApiBaseUrl(storedValue) : DEFAULT_API_BASE_URL;

  return runtimeApiBaseUrl;
}

export async function persistApiBaseUrl(value: string) {
  const normalized = sanitizeApiBaseUrl(value);
  runtimeApiBaseUrl = normalized;
  await setStoredApiBaseUrl(normalized);

  return normalized;
}

export async function resetApiBaseUrl() {
  runtimeApiBaseUrl = DEFAULT_API_BASE_URL;
  await clearStoredApiBaseUrl();

  return runtimeApiBaseUrl;
}
