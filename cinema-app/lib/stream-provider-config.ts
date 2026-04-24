import Constants from 'expo-constants';

type StreamProviderExtraConfig = {
  allowedProviderHosts?: string[] | string;
  externalStreamEndpoint?: string;
};

function readExtraConfig() {
  return (Constants.expoConfig?.extra ?? {}) as StreamProviderExtraConfig;
}

function normalizeHost(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

function normalizeOptionalUrl(value: string) {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : '';
}

function parseHostList(value: string[] | string | null | undefined) {
  const rawValues = Array.isArray(value) ? value : String(value || '').split(',');

  return [...new Set(rawValues.map(normalizeHost).filter(Boolean))];
}

const extraConfig = readExtraConfig();

export const CONFIGURED_ALLOWED_PROVIDER_HOSTS = parseHostList(
  process.env.EXPO_PUBLIC_ALLOWED_STREAM_PROVIDER_HOSTS ?? extraConfig.allowedProviderHosts,
);

export const CONFIGURED_EXTERNAL_STREAM_ENDPOINT = normalizeOptionalUrl(
  process.env.EXPO_PUBLIC_EXTERNAL_STREAM_ENDPOINT ?? extraConfig.externalStreamEndpoint ?? '',
);
