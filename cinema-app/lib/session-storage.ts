import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'cinema_app_auth_token';

function webStorageAvailable() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!window.localStorage;
}

export async function getStoredToken() {
  if (webStorageAvailable()) {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setStoredToken(token: string) {
  if (webStorageAvailable()) {
    window.localStorage.setItem(TOKEN_KEY, token);
    return;
  }

  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearStoredToken() {
  if (webStorageAvailable()) {
    window.localStorage.removeItem(TOKEN_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

