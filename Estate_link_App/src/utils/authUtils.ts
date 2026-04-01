import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Helper function to get auth token from AsyncStorage
export const getAuthToken = async (): Promise<string | null> => {
  try {
    const persistedState = await AsyncStorage.getItem('persist:root');
    if (persistedState) {
      const parsedState = JSON.parse(persistedState);
      if (parsedState.auth) {
        const authState = JSON.parse(parsedState.auth);
        return authState.accessToken || null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
};

// Helper function to get refresh token from AsyncStorage
export const getRefreshToken = async (): Promise<string | null> => {
  try {
    const persistedState = await AsyncStorage.getItem('persist:root');
    if (persistedState) {
      const parsedState = JSON.parse(persistedState);
      if (parsedState.auth) {
        const authState = JSON.parse(parsedState.auth);
        return authState.refreshToken || null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error retrieving refresh token:', error);
    return null;
  }
};

// Helper function to update tokens in AsyncStorage
export const updateTokens = async (accessToken: string, refreshToken?: string): Promise<void> => {
  try {
    const persistedState = await AsyncStorage.getItem('persist:root');
    if (persistedState) {
      const parsedState = JSON.parse(persistedState);
      if (parsedState.auth) {
        const authState = JSON.parse(parsedState.auth);
        authState.accessToken = accessToken;
        if (refreshToken) {
          authState.refreshToken = refreshToken;
        }
        parsedState.auth = JSON.stringify(authState);
        await AsyncStorage.setItem('persist:root', JSON.stringify(parsedState));
      }
    }
  } catch (error) {
    console.error('Error updating tokens:', error);
  }
};

// Helper function to get auth headers
export const getAuthHeaders = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Source': 'mobile',  // Identifies this as a mobile app request
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// Helper function to get auth headers for FormData (no Content-Type)
export const getAuthHeadersForFormData = (token?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'X-App-Source': 'mobile',  // Identifies this as a mobile app request
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// Remember Me helpers (username only - do not store passwords here)
const REMEMBER_ME_USERNAME_KEY = 'remember_me_username';
const REMEMBER_ME_FLAG_KEY = 'remember_me_enabled';

export const saveRememberedUsername = async (username: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(REMEMBER_ME_USERNAME_KEY, username);
    await AsyncStorage.setItem(REMEMBER_ME_FLAG_KEY, 'true');
  } catch (error) {
    console.error('Error saving remembered username:', error);
  }
};

export const getRememberedUsername = async (): Promise<{ username: string | null; enabled: boolean }> => {
  try {
    const [username, flag] = await Promise.all([
      AsyncStorage.getItem(REMEMBER_ME_USERNAME_KEY),
      AsyncStorage.getItem(REMEMBER_ME_FLAG_KEY),
    ]);
    return { username, enabled: flag === 'true' && !!username };
  } catch (error) {
    console.error('Error retrieving remembered username:', error);
    return { username: null, enabled: false };
  }
};

export const clearRememberedUsername = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([REMEMBER_ME_USERNAME_KEY, REMEMBER_ME_FLAG_KEY]);
  } catch (error) {
    console.error('Error clearing remembered username:', error);
  }
};

// Username suggestions (history)
const USERNAME_HISTORY_KEY = 'username_history_list';
const USERNAME_HISTORY_LIMIT = 8;

export const getUsernameSuggestions = async (query?: string): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(USERNAME_HISTORY_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!query) return list;
    const lower = query.toLowerCase();
    return list.filter(u => u.toLowerCase().includes(lower));
  } catch (error) {
    console.error('Error getting username suggestions:', error);
    return [];
  }
};

export const addUsernameToHistory = async (username: string): Promise<void> => {
  const clean = username.trim();
  if (!clean) return;
  try {
    const raw = await AsyncStorage.getItem(USERNAME_HISTORY_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const withoutDupes = [clean, ...list.filter(u => u.toLowerCase() !== clean.toLowerCase())];
    const limited = withoutDupes.slice(0, USERNAME_HISTORY_LIMIT);
    await AsyncStorage.setItem(USERNAME_HISTORY_KEY, JSON.stringify(limited));
  } catch (error) {
    console.error('Error adding username to history:', error);
  }
};

export const clearUsernameHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USERNAME_HISTORY_KEY);
  } catch (error) {
    console.error('Error clearing username history:', error);
  }
};

// Secure password suggestions per username (Expo SecureStore)
// Sanitize username to only contain allowed SecureStore key characters (alphanumeric, ".", "-", "_")
const sanitizeKey = (str: string): string => {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_') // Replace invalid chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
};

const passwordKeyForUser = (username: string) => {
  const sanitized = sanitizeKey(username.trim());
  if (!sanitized) {
    // Fallback if username becomes empty after sanitization
    return 'pw_vault_default';
  }
  return `pw_vault_${sanitized}`;
};
const PASSWORD_HISTORY_LIMIT = 3;

export const addPasswordForUsername = async (username: string, password: string): Promise<void> => {
  const user = username.trim();
  const pass = password.trim();
  if (!user || !pass) return;
  try {
    const key = passwordKeyForUser(user);
    const raw = await SecureStore.getItemAsync(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const withoutDupes = [pass, ...list.filter(p => p !== pass)];
    const limited = withoutDupes.slice(0, PASSWORD_HISTORY_LIMIT);
    await SecureStore.setItemAsync(key, JSON.stringify(limited));
  } catch (error) {
    console.error('Error saving password suggestion:', error);
  }
};

export const getPasswordSuggestionsForUsername = async (username: string): Promise<string[]> => {
  const user = username.trim();
  if (!user) return [];
  try {
    const key = passwordKeyForUser(user);
    const raw = await SecureStore.getItemAsync(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return list;
  } catch (error) {
    console.error('Error reading password suggestions:', error);
    return [];
  }
};

export const clearPasswordSuggestionsForUsername = async (username: string): Promise<void> => {
  const user = username.trim();
  if (!user) return;
  try {
    const key = passwordKeyForUser(user);
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.error('Error clearing password suggestions:', error);
  }
};

