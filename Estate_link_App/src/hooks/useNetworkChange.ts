import { useState, useEffect, useCallback } from 'react';
import { networkChangeHandler, handleNetworkChangeAutomatically, forceNetworkRediscovery } from '../utils/networkChangeHandler';
import { getNetworkStatus } from '../utils/networkUtils';

export interface NetworkStatus {
  isConnected: boolean;
  lastKnownIP: string | null;
  lastCheck: number;
  retryCount: number;
}

export interface UseNetworkChangeReturn {
  networkStatus: NetworkStatus;
  isHandlingChange: boolean;
  handleNetworkChange: () => Promise<boolean>;
  forceRediscovery: () => Promise<boolean>;
  refreshStatus: () => void;
}

export const useNetworkChange = (): UseNetworkChangeReturn => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(getNetworkStatus());
  const [isHandlingChange, setIsHandlingChange] = useState(false);

  // Handle network change notifications
  const handleNetworkChangeNotification = useCallback((isConnected: boolean, backendURL: string) => {
    console.log(`📱 Network change notification: ${isConnected ? 'Connected' : 'Disconnected'} to ${backendURL}`);
    
    // Update local state
    setNetworkStatus(getNetworkStatus());
  }, []);

  // Register for network change notifications
  useEffect(() => {
    networkChangeHandler.onNetworkChange(handleNetworkChangeNotification);
    
    // Cleanup on unmount
    return () => {
      networkChangeHandler.offNetworkChange(handleNetworkChangeNotification);
    };
  }, [handleNetworkChangeNotification]);

  // Manual network change handling
  const handleNetworkChange = useCallback(async (): Promise<boolean> => {
    setIsHandlingChange(true);
    try {
      const result = await handleNetworkChangeAutomatically();
      setNetworkStatus(getNetworkStatus());
      return result;
    } finally {
      setIsHandlingChange(false);
    }
  }, []);

  // Force network rediscovery
  const forceRediscovery = useCallback(async (): Promise<boolean> => {
    setIsHandlingChange(true);
    try {
      const result = await forceNetworkRediscovery();
      setNetworkStatus(getNetworkStatus());
      return result;
    } finally {
      setIsHandlingChange(false);
    }
  }, []);

  // Refresh network status
  const refreshStatus = useCallback(() => {
    setNetworkStatus(getNetworkStatus());
  }, []);

  // Initial status update
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return {
    networkStatus,
    isHandlingChange,
    handleNetworkChange,
    forceRediscovery,
    refreshStatus,
  };
};
