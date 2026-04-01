import Constants from 'expo-constants';
import { Platform } from 'react-native';

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function extractLanHost(candidate?: string | null): string | null {
  if (!candidate) {
    return null;
  }

  const normalized = candidate.replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0]?.trim();

  if (!normalized) {
    return null;
  }

  const host = normalized.split(':')[0]?.trim();

  if (!host) {
    return null;
  }

  const isPrivateIpv4 =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

  if (isPrivateIpv4 || host.endsWith('.local')) {
    return host;
  }

  return null;
}

function deriveApiBaseUrlFromExpoRuntime(): string | null {
  const hostCandidates = [
    Constants.expoConfig?.hostUri,
    Constants.platform?.hostUri,
    Constants.linkingUri,
  ];

  for (const candidate of hostCandidates) {
    const host = extractLanHost(candidate);

    if (host) {
      return `http://${host}:8000/api`;
    }
  }

  return null;
}

export const FALLBACK_API_BASE_URL =
  deriveApiBaseUrlFromExpoRuntime() ??
  Platform.select({
    android: 'http://10.0.2.2:8000/api',
    ios: 'http://127.0.0.1:8000/api',
    default: 'http://localhost:8000/api',
  })!;

const configuredApiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  FALLBACK_API_BASE_URL;

export const DEFAULT_API_BASE_URL = normalizeApiBaseUrl(String(configuredApiBaseUrl));

export function sanitizeApiBaseUrl(value: string) {
  return normalizeApiBaseUrl(value);
}
