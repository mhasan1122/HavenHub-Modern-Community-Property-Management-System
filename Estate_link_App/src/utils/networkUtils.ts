// Network utility functions
import { getCurrentConfig, getBackendURL } from '../config/environment';
import { getAuthToken, getRefreshToken, updateTokens } from './authUtils';

// Network status tracking
let currentNetworkStatus = {
  isConnected: false,
  lastKnownIP: null as string | null,
  lastCheck: 0,
  retryCount: 0
};

// Function to discover backend server IP dynamically
export const discoverBackendServer = async (): Promise<string> => {
  console.log('🔍 Starting backend server discovery...');

  // Get the configured backend URL first
  const configuredURL = getBackendURL();
  console.log('📱 Using configured backend URL:', configuredURL);

  // Common local network IP ranges to try - updated with current network
  // Note: localhost and 127.0.0.1 won't work on physical devices, only on emulators/simulators
  const commonIPs = [
    '192.168.0.219',  // Current machine IP (primary) - for physical devices
    '192.168.0.113',  // Alternative network IP
    '10.0.2.2',       // Android emulator (host machine)
    // Note: localhost and 127.0.0.1 removed - they don't work on physical devices
  ];

  // Try the configured URL first
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Increased timeout

    const response = await fetch(`${configuredURL}/`, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    if (response.ok || response.status < 500) {
      console.log(`✅ Backend server found at configured URL: ${configuredURL}`);
      currentNetworkStatus.lastKnownIP = configuredURL;
      currentNetworkStatus.isConnected = true;
      currentNetworkStatus.retryCount = 0;
      return configuredURL;
    }
  } catch (error) {
    console.log('❌ Configured URL not accessible, trying alternatives...');
  }

  // Try to find the backend server by testing common IPs
  console.log('🔍 Testing common IP addresses...');
  for (const ip of commonIPs) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout for discovery

      console.log(`🔍 Testing IP: ${ip}`);
      const response = await fetch(`http://${ip}:8000/`, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      if (response.ok || response.status < 500) {
        console.log(`✅ Backend server found at: ${ip}`);
        currentNetworkStatus.lastKnownIP = `http://${ip}:8000`;
        currentNetworkStatus.isConnected = true;
        currentNetworkStatus.retryCount = 0;
        return `http://${ip}:8000`;
      }
    } catch (error) {
      console.log(`❌ IP ${ip} not accessible`);
      continue;
    }
  }

  // If no common IPs work, try to scan the current network
  console.log('🔍 Scanning current network subnet...');
  try {
    // Get current device's IP and try to find server in the same subnet
    const currentIP = await getCurrentDeviceIP();
    if (currentIP) {
      const subnet = currentIP.substring(0, currentIP.lastIndexOf('.'));
      console.log(`🔍 Scanning subnet: ${subnet}.*`);

      // Scan common ports and IPs in the subnet
      for (let i = 1; i <= 254; i++) {
        try {
          const testIP = `${subnet}.${i}`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5 second timeout for scanning

          const response = await fetch(`http://${testIP}:8000/`, {
            method: 'HEAD',
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          if (response.ok || response.status < 500) {
            console.log(`✅ Backend server found at: ${testIP}`);
            currentNetworkStatus.lastKnownIP = `http://${testIP}:8000`;
            currentNetworkStatus.isConnected = true;
            currentNetworkStatus.retryCount = 0;
            return `http://${testIP}:8000`;
          }
        } catch (error) {
          // Continue to next IP
          continue;
        }
      }
    }
  } catch (error) {
    console.log('❌ Network scanning failed:', error);
  }

  // If still no server found, try some additional common ports
  console.log('🔍 Trying additional common ports...');
  const lastKnownIP = currentNetworkStatus.lastKnownIP;

  if (lastKnownIP) {
    const baseIP = lastKnownIP.split(':')[0];
    const additionalPorts = [3000, 5000, 8000, 8080, 9000];
    for (const port of additionalPorts) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`http://${baseIP}:${port}/`, {
          method: 'HEAD',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (response.ok || response.status < 500) {
          console.log(`✅ Backend server found at: ${baseIP}:${port}`);
          currentNetworkStatus.lastKnownIP = `http://${baseIP}:${port}`;
          currentNetworkStatus.isConnected = true;
          currentNetworkStatus.retryCount = 0;
          return `http://${baseIP}:${port}`;
        }
      } catch (error) {
        continue;
      }
    }
  }

  // Update network status
  currentNetworkStatus.isConnected = false;
  currentNetworkStatus.retryCount++;

  console.log('❌ No backend server found, using fallback URL');
  // Fallback to the configured URL
  return configuredURL;
};

// Function to get current device's IP (simplified version)
const getCurrentDeviceIP = async (): Promise<string | null> => {
  try {
    // This is a simplified approach - in a real app you might use a native module
    // For now, we'll return null and rely on common IP scanning
    return null;
  } catch (error) {
    return null;
  }
};

// Enhanced network connectivity check with automatic retry
export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    // Ensure API_CONFIG is initialized
    await initializeAPIConfig();

    // First try to reach our backend server
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for connectivity check

    await fetch(`${API_CONFIG.BASE_URL}/`, {
      method: 'HEAD',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    currentNetworkStatus.isConnected = true;
    currentNetworkStatus.retryCount = 0;
    return true; // If we can reach the server, even with an error response, network is working
  } catch (error) {
    console.log('❌ Backend connectivity check failed, trying Google:', error);
    currentNetworkStatus.isConnected = false;

    // Fallback to Google connectivity check
    try {
      const response = await fetch('https://www.google.com', {
        method: 'HEAD'
      });
      return response.ok;
    } catch (fallbackError) {
      console.log('❌ Network connectivity check failed:', fallbackError);
      return false;
    }
  }
};

// Function to handle network changes and rediscover backend
export const handleNetworkChange = async (): Promise<string> => {
  console.log('🔄 Network change detected, rediscovering backend server...');

  // Reset network status
  currentNetworkStatus.isConnected = false;
  currentNetworkStatus.lastCheck = Date.now();

  // Try to discover the backend server again
  try {
    const newBackendURL = await discoverBackendServer();

    // Update API config with new URL
    API_CONFIG.BASE_URL = newBackendURL;

    console.log(`✅ Network change handled. New backend URL: ${newBackendURL}`);
    return newBackendURL;
  } catch (error) {
    console.log('❌ Failed to handle network change:', error);
    // Return fallback URL instead of potentially undefined API_CONFIG.BASE_URL
    return getBackendURL();
  }
};

// Function to check if we need to rediscover backend (e.g., after network errors)
export const shouldRediscoverBackend = (): boolean => {
  const timeSinceLastCheck = Date.now() - currentNetworkStatus.lastCheck;
  const maxRetryTime = 30000; // 30 seconds

  return (
    !currentNetworkStatus.isConnected ||
    currentNetworkStatus.retryCount > 3 ||
    timeSinceLastCheck > maxRetryTime
  );
};

export const getNetworkErrorMessage = (error: any): string => {
  if (error.name === 'AbortError' || error.message === 'Aborted') {
    return 'Request timed out. Please check your internet connection and try again.';
  }

  if (error.message?.includes('Network request failed')) {
    return 'Network error. Please check your internet connection and try again.';
  }

  if (error.message?.includes('fetch')) {
    return 'Unable to connect to server. Please try again later.';
  }

  if (error.message?.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  return error.message || 'An unexpected error occurred. Please try again.';
};

export const isNetworkError = (error: any): boolean => {
  return (
    error.name === 'AbortError' ||
    error.message?.includes('Network request failed') ||
    error.message?.includes('fetch') ||
    error.message?.includes('timeout') ||
    error.message?.includes('network') ||
    error.message?.includes('connection')
  );
};

// Get the appropriate base URL for different environments
const getBaseUrl = async (): Promise<string> => {
  // Check if we need to rediscover the backend
  if (shouldRediscoverBackend()) {
    console.log('🔄 Rediscovering backend server...');
    try {
      const discoveredURL = await discoverBackendServer();
      return discoveredURL;
    } catch (error) {
      console.log('❌ Failed to discover backend server, using fallback:', error);
      // Fallback to common IPs
      return 'http://192.168.0.185:8000';
    }
  }

  // Use last known working IP if available
  if (currentNetworkStatus.lastKnownIP && currentNetworkStatus.isConnected) {
    return currentNetworkStatus.lastKnownIP;
  }

  // Fallback to configured URL
  return getBackendURL();
};

// API configuration with dynamic base URL
export const API_CONFIG = {
  BASE_URL: getBackendURL(), // Use environment configuration
  TIMEOUT: getCurrentConfig().API_TIMEOUT,
  RETRY_ATTEMPTS: getCurrentConfig().RETRY_ATTEMPTS,
  RETRY_DELAY: getCurrentConfig().RETRY_DELAY,
};

// Initialize API config with dynamic base URL
export const initializeAPIConfig = async (): Promise<void> => {
  try {
    const baseURL = await getBaseUrl();
    API_CONFIG.BASE_URL = baseURL;
    console.log('✅ API Base URL initialized to:', baseURL);
  } catch (error) {
    console.log('❌ Failed to initialize API config:', error);
  }
};

// Token refresh state management
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;
const refreshSubscribers: Array<(token: string) => void> = [];

// Subscribe to token refresh
const subscribeTokenRefresh = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// Notify all subscribers of new token
const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach(callback => callback(token));
  refreshSubscribers.length = 0;
};

// Refresh access token using refresh token
const refreshAccessToken = async (): Promise<string | null> => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        console.warn('⚠️ No refresh token available for token refresh');
        return null;
      }

      console.log('🔄 Refreshing access token...');
      const response = await fetch(`${API_CONFIG.BASE_URL}/user/token/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Token refresh failed: ${response.status} - ${errorText}`);
        throw new Error(`Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      const newAccessToken = data.access;
      const newRefreshToken = data.refresh || refreshToken;

      // Update tokens in storage
      await updateTokens(newAccessToken, newRefreshToken);

      console.log('✅ Access token refreshed successfully');
      onTokenRefreshed(newAccessToken);
      return newAccessToken;
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Enhanced fetch with better error handling, automatic retry, and token refresh
export const enhancedFetch = async (
  url: string,
  options: RequestInit = {},
  timeout = API_CONFIG.TIMEOUT,
  authToken?: string
): Promise<Response> => {
  // Get token from parameter or storage if not provided
  let token = authToken;
  if (!token) {
    // Check if Authorization header is already set
    const existingAuth = (options.headers as Record<string, string>)?.Authorization;
    if (existingAuth && existingAuth.startsWith('Bearer ')) {
      token = existingAuth.substring(7);
    } else {
      token = await getAuthToken() || undefined;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-App-Source': 'mobile',  // Identifies this as a mobile app request
      ...(options.headers as Record<string, string> || {}),
    };

    // Add Content-Type only if not FormData
    if (!(options.body instanceof FormData)) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    }

    // Add authentication header if token is available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);

    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401 && token) {
      console.log('🔄 Received 401, attempting token refresh...');

      // If refresh is already in progress, wait for it
      if (isRefreshing && refreshPromise) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(async (newToken) => {
            try {
              // Clone headers and options to avoid mutating original
              const retryHeaders = { ...headers };
              retryHeaders['Authorization'] = `Bearer ${newToken}`;
              const retryOptions = { ...options, headers: retryHeaders };

              const retryController = new AbortController();
              const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);

              const retryResponse = await fetch(url, {
                ...retryOptions,
                signal: retryController.signal,
              });
              clearTimeout(retryTimeoutId);

              currentNetworkStatus.isConnected = true;
              currentNetworkStatus.retryCount = 0;
              resolve(retryResponse);
            } catch (error) {
              reject(error);
            }
          });
        });
      }

      // Attempt to refresh token
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          // Clone headers and options to avoid mutating original
          const retryHeaders = { ...headers };
          retryHeaders['Authorization'] = `Bearer ${newToken}`;
          const retryOptions = { ...options, headers: retryHeaders };

          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), timeout);

          const retryResponse = await fetch(url, {
            ...retryOptions,
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);

          currentNetworkStatus.isConnected = true;
          currentNetworkStatus.retryCount = 0;
          return retryResponse;
        }
      } catch (refreshError) {
        console.error('❌ Token refresh failed, returning original 401 response');
        // Return original 401 response if refresh fails
        currentNetworkStatus.isConnected = false;
        return response;
      }
    }

    // Update network status on success
    currentNetworkStatus.isConnected = true;
    currentNetworkStatus.retryCount = 0;

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    // Update network status on error
    if (isNetworkError(error)) {
      currentNetworkStatus.isConnected = false;
      currentNetworkStatus.retryCount++;
    }

    throw error;
  }
};

// Export network status for debugging
export const getNetworkStatus = () => currentNetworkStatus; 