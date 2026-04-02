import Constants from 'expo-constants';

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  'https://cinema-notes-api.semgacinema20260402.workers.dev/api';

export const DEFAULT_API_BASE_URL = normalizeApiBaseUrl(String(configuredApiBaseUrl));

export function sanitizeApiBaseUrl(value: string) {
  return normalizeApiBaseUrl(value);
}
