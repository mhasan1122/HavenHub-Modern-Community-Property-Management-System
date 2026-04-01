import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { API_CONFIG } from '../utils/networkUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logout, updateTokens } from '../store/slices/authSlice';
import { getRefreshToken } from '../utils/authUtils';

/**
 * Hook for automatic token refresh
 * - Refreshes token periodically before expiration
 * - Refreshes token when app returns to foreground
 * - Handles token blacklist and expiration
 */
export const useAutoTokenRefresh = () => {
  const dispatch = useAppDispatch();
  const { isAuthenticated, accessToken, refreshToken } = useAppSelector((state) => state.auth);
  const appState = useRef(AppState.currentState);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshTime = useRef<number>(Date.now());

  // Function to refresh the access token
  const refreshAccessToken = async () => {
    try {
      const storedRefreshToken = await getRefreshToken();
      if (!storedRefreshToken) {
        console.log('⚠️ No refresh token available');
        return false;
      }

      console.log('🔄 Auto-refreshing access token...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/user/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: storedRefreshToken }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Token refresh failed:', response.status, '-', JSON.stringify(errorData));

        // Check if token is blacklisted, invalid, or expired
        if (
          errorData.code === 'token_not_valid' ||
          errorData.detail?.includes('blacklist') ||
          errorData.detail?.includes('invalid') ||
          errorData.detail?.includes('expired')
        ) {
          console.log('🚪 Token is invalid/blacklisted/expired - logging out user');
          console.log('📋 Error details:', errorData);
          dispatch(logout());
          return false;
        }

        console.error('❌ Other token refresh error:', errorData);
        return false;
      }

      const data = await response.json();
      const newAccessToken = data.access;
      const newRefreshToken = data.refresh || storedRefreshToken;

      // Update Redux store with new tokens
      // redux-persist will automatically sync this to AsyncStorage
      dispatch(updateTokens({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }));

      console.log('✅ Access token auto-refreshed successfully');
      lastRefreshTime.current = Date.now();
      return true;
    } catch (error) {
      console.error('❌ Error auto-refreshing token:', error);
      return false;
    }
  };

  // Handle app state changes (foreground/background)
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log(`📱 App state changed: ${appState.current} → ${nextAppState}`);

    // When app comes to foreground
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active' &&
      isAuthenticated &&
      accessToken
    ) {
      const timeSinceLastRefresh = Date.now() - lastRefreshTime.current;
      const refreshThreshold = 2 * 60 * 1000; // 2 minutes

      // If more than 2 minutes since last refresh, refresh the token
      if (timeSinceLastRefresh > refreshThreshold) {
        console.log('🔄 App returned to foreground - refreshing token');
        await refreshAccessToken();
      } else {
        console.log('✅ Token recently refreshed, skipping refresh');
      }
    }

    appState.current = nextAppState;
  };

  // Set up periodic token refresh
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      // Clear interval if user is not authenticated
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    console.log('🔄 Setting up automatic token refresh');

    // Refresh token every 4 minutes (assuming token expires in 5 minutes)
    const REFRESH_INTERVAL = 4 * 60 * 1000; // 4 minutes in milliseconds

    // Set up periodic refresh
    refreshIntervalRef.current = setInterval(async () => {
      console.log('⏰ Periodic token refresh triggered');
      await refreshAccessToken();
    }, REFRESH_INTERVAL);

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      subscription.remove();
      console.log('🛑 Stopped automatic token refresh');
    };
  }, [isAuthenticated, accessToken]);

  return {
    refreshAccessToken,
    lastRefreshTime: lastRefreshTime.current,
  };
};
