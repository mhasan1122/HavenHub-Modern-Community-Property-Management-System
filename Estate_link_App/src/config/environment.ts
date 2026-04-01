// Environment configuration for different deployment scenarios

export const ENVIRONMENT = {
  // Development environment
  DEV: {
    BACKEND_URL: ['https://api.estatelink.cloud'], // Network IP for physical devices - localhost won't work on physical devices

    API_TIMEOUT: 10000,
    RETRY_ATTEMPTS: 3, // Increased retry attempts
    RETRY_DELAY: 1000,
    AUTO_DISCOVERY: true, // Enable automatic backend discovery
    NETWORK_CHECK_INTERVAL: 30000, // 30 seconds
  },

  // Local development (same machine)
  LOCAL: {
    BACKEND_URL: 'https://api.estatelink.cloud', // Local network IP for physical devices
    API_TIMEOUT: 5000,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 500,
    AUTO_DISCOVERY: true,
    NETWORK_CHECK_INTERVAL: 15000, // 15 seconds for local
  },

  // Production environment (hosted backend)
  PROD: {
    BACKEND_URL: 'https://api.estatelink.cloud',
    API_TIMEOUT: 15000,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000,
    AUTO_DISCOVERY: false,
    NETWORK_CHECK_INTERVAL: 60000,
  }
};

// Current environment: 'DEV' = local backend, 'PROD' = https://api.estatelink.cloud (for ADB/device testing)
export const CURRENT_ENV = 'DEV';

// Get current environment configuration
export const getCurrentConfig = () => {
  return ENVIRONMENT[CURRENT_ENV as keyof typeof ENVIRONMENT];
};

// Helper function to get backend URL
// Helper function to get backend URL
export const getBackendURL = (): string => {
  const url = getCurrentConfig().BACKEND_URL;
  return Array.isArray(url) ? url[0] : url;
};

// Helper function to get API timeout
export const getAPITimeout = (): number => {
  return getCurrentConfig().API_TIMEOUT;
};

// Helper function to check if auto-discovery is enabled
export const isAutoDiscoveryEnabled = (): boolean => {
  return getCurrentConfig().AUTO_DISCOVERY;
};

// Helper function to get network check interval
export const getNetworkCheckInterval = (): number => {
  return getCurrentConfig().NETWORK_CHECK_INTERVAL;
};

// Function to update backend URL dynamically
export const updateBackendURL = (newURL: string): void => {
  const currentConfig = getCurrentConfig();
  if (currentConfig) {
    // Update the environment configuration
    currentConfig.BACKEND_URL = newURL;
    console.log(`✅ Backend URL updated to: ${newURL}`);
  }
};

// Function to get fallback URLs for network discovery
export const getFallbackURLs = (): string[] => {
  return [
    'https://api.estatelink.cloud', // Hosted backend - PRIMARY FALLBACK
    'http://192.168.0.219:8000',// Network IP (physical device) 
    'http://10.0.2.2:8000',      // Android emulator (host machine)
    'http://localhost:8000',     // Local (iOS simulator only - won't work on physical devices)
    'http://127.0.0.1:8000',     // Local alternative (iOS simulator only)
  ];
};

