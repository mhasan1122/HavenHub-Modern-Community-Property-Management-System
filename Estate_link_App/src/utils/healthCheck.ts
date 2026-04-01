import { API_CONFIG, discoverBackendServer, handleNetworkChange, getNetworkStatus } from './networkUtils';

export interface HealthCheckResult {
  isHealthy: boolean;
  message: string;
  responseTime?: number;
  details?: any;
}

export const performHealthCheck = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    console.log('Performing health check on:', API_CONFIG.BASE_URL);
    
    // Simple fetch to check if server is responding
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${API_CONFIG.BASE_URL}/`, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    
    console.log(`Health check completed in ${responseTime}ms with status: ${response.status}`);
    
    return {
      isHealthy: true,
      message: `Server is responding (${response.status})`,
      responseTime,
      details: {
        status: response.status,
        statusText: response.statusText,
        backendURL: API_CONFIG.BASE_URL,
      }
    };
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    console.error('Health check failed:', error);
    
    let message = 'Server is not responding';
    if (error.name === 'AbortError') {
      message = 'Server response timeout (>10s)';
    } else if (error.message?.includes('Network request failed')) {
      message = 'Network connection failed';
    } else if (error.message?.includes('fetch')) {
      message = 'Unable to reach server';
    }
    
    return {
      isHealthy: false,
      message,
      responseTime,
      details: {
        error: error.message,
        name: error.name,
        backendURL: API_CONFIG.BASE_URL,
        networkStatus: getNetworkStatus(),
      }
    };
  }
};

// Enhanced health check with automatic retry and network discovery
export const performEnhancedHealthCheck = async (): Promise<HealthCheckResult> => {
  const startTime = Date.now();
  
  try {
    console.log('🔍 Starting enhanced health check...');
    
    // First, try the current backend URL
    let result = await performHealthCheck();
    
    // If healthy, return immediately
    if (result.isHealthy) {
      return result;
    }
    
    // If not healthy, try to discover a new backend server
    console.log('🔄 Health check failed, attempting to discover new backend server...');
    
    try {
      const newBackendURL = await discoverBackendServer();
      
      // Update API config with new URL
      API_CONFIG.BASE_URL = newBackendURL;
      
      console.log(`✅ Discovered new backend URL: ${newBackendURL}`);
      
      // Try health check again with new URL
      const retryResult = await performHealthCheck();
      
      if (retryResult.isHealthy) {
        console.log('✅ Health check successful with new backend URL');
        return {
          ...retryResult,
          message: `Server rediscovered and responding (${retryResult.details?.status})`,
          details: {
            ...retryResult.details,
            backendRediscovered: true,
            newBackendURL,
          }
        };
      }
      
      // If still not healthy, return the retry result
      return retryResult;
      
    } catch (discoveryError) {
      console.log('❌ Failed to discover new backend server:', discoveryError);
      
              // Return original result with discovery failure info
        return {
          ...result,
          details: {
            ...result.details,
            discoveryFailed: true,
            discoveryError: discoveryError instanceof Error ? discoveryError.message : String(discoveryError),
          }
        };
    }
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    console.error('Enhanced health check failed:', error);
    
    return {
      isHealthy: false,
      message: 'Enhanced health check failed',
      responseTime,
      details: {
        error: error.message,
        name: error.name,
        backendURL: API_CONFIG.BASE_URL,
        networkStatus: getNetworkStatus(),
      }
    };
  }
};

// Function to handle network changes and perform health check
export const handleNetworkChangeAndHealthCheck = async (): Promise<HealthCheckResult> => {
  console.log('🔄 Handling network change and performing health check...');
  
  try {
    // Handle network change
    const newBackendURL = await handleNetworkChange();
    
    // Perform health check with new backend
    const healthResult = await performHealthCheck();
    
    return {
      ...healthResult,
      details: {
        ...healthResult.details,
        networkChangeHandled: true,
        newBackendURL,
      }
    };
    
  } catch (error: any) {
    console.error('Failed to handle network change and health check:', error);
    
    return {
      isHealthy: false,
      message: 'Failed to handle network change',
      details: {
        error: error.message,
        name: error.name,
        backendURL: API_CONFIG.BASE_URL,
        networkStatus: getNetworkStatus(),
      }
    };
  }
};

export const logHealthCheckResult = (result: HealthCheckResult) => {
  console.log('=== Health Check Result ===');
  console.log('Healthy:', result.isHealthy);
  console.log('Message:', result.message);
  console.log('Response Time:', result.responseTime, 'ms');
  if (result.details) {
    console.log('Details:', result.details);
  }
  console.log('==========================');
};

// Export network status for debugging
export const getCurrentNetworkStatus = () => getNetworkStatus();
