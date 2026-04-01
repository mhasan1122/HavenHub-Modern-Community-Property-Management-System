import { handleNetworkChange, getNetworkStatus, shouldRediscoverBackend } from './networkUtils';
import { performEnhancedHealthCheck, handleNetworkChangeAndHealthCheck } from './healthCheck';

// Network change detection and handling
export class NetworkChangeHandler {
  private static instance: NetworkChangeHandler;
  private networkChangeCallbacks: Array<(isConnected: boolean, backendURL: string) => void> = [];
  private isHandlingChange = false;
  private lastNetworkCheck = 0;
  private checkInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startNetworkMonitoring();
  }

  public static getInstance(): NetworkChangeHandler {
    if (!NetworkChangeHandler.instance) {
      NetworkChangeHandler.instance = new NetworkChangeHandler();
    }
    return NetworkChangeHandler.instance;
  }

  // Start monitoring network changes
  private startNetworkMonitoring(): void {
    // Check network every 30 seconds
    this.checkInterval = setInterval(async () => {
      await this.checkAndHandleNetworkChanges();
    }, 30000);

    // Also check when app becomes active (if you have app state listeners)
    this.setupAppStateListeners();
  }

  // Setup app state listeners for when app comes to foreground
  private setupAppStateListeners(): void {
    // This would integrate with React Native's AppState
    // For now, we'll rely on the interval-based checking
    console.log('📱 Network monitoring started');
  }

  // Check for network changes and handle them automatically
  private async checkAndHandleNetworkChanges(): Promise<void> {
    if (this.isHandlingChange) {
      console.log('⏳ Network change already being handled, skipping...');
      return;
    }

    try {
      this.isHandlingChange = true;
      
      // Check if we need to rediscover backend
      if (shouldRediscoverBackend()) {
        console.log('🔄 Network change detected, handling automatically...');
        
        const result = await handleNetworkChangeAndHealthCheck();
        
        if (result.isHealthy) {
          console.log('✅ Network change handled successfully');
          this.notifyNetworkChange(true, result.details?.newBackendURL || 'Unknown');
        } else {
          console.log('❌ Network change handling failed');
          this.notifyNetworkChange(false, 'Unknown');
        }
      }
      
    } catch (error) {
      console.error('❌ Error during network change handling:', error);
      this.notifyNetworkChange(false, 'Error');
    } finally {
      this.isHandlingChange = false;
      this.lastNetworkCheck = Date.now();
    }
  }

  // Manual network change handling
  public async handleNetworkChange(): Promise<boolean> {
    try {
      console.log('🔄 Manual network change handling requested...');
      
      const result = await handleNetworkChangeAndHealthCheck();
      
      if (result.isHealthy) {
        console.log('✅ Manual network change handling successful');
        this.notifyNetworkChange(true, result.details?.newBackendURL || 'Unknown');
        return true;
      } else {
        console.log('❌ Manual network change handling failed');
        this.notifyNetworkChange(false, 'Unknown');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error during manual network change handling:', error);
      this.notifyNetworkChange(false, 'Error');
      return false;
    }
  }

  // Force network rediscovery
  public async forceNetworkRediscovery(): Promise<boolean> {
    try {
      console.log('🔄 Forcing network rediscovery...');
      
      const result = await performEnhancedHealthCheck();
      
      if (result.isHealthy) {
        console.log('✅ Forced network rediscovery successful');
        this.notifyNetworkChange(true, result.details?.backendURL || 'Unknown');
        return true;
      } else {
        console.log('❌ Forced network rediscovery failed');
        this.notifyNetworkChange(false, 'Unknown');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error during forced network rediscovery:', error);
      this.notifyNetworkChange(false, 'Error');
      return false;
    }
  }

  // Register callback for network change notifications
  public onNetworkChange(callback: (isConnected: boolean, backendURL: string) => void): void {
    this.networkChangeCallbacks.push(callback);
  }

  // Remove callback for network change notifications
  public offNetworkChange(callback: (isConnected: boolean, backendURL: string) => void): void {
    const index = this.networkChangeCallbacks.indexOf(callback);
    if (index > -1) {
      this.networkChangeCallbacks.splice(index, 1);
    }
  }

  // Notify all registered callbacks about network changes
  private notifyNetworkChange(isConnected: boolean, backendURL: string): void {
    console.log(`📡 Notifying network change: ${isConnected ? 'Connected' : 'Disconnected'} to ${backendURL}`);
    
    this.networkChangeCallbacks.forEach(callback => {
      try {
        callback(isConnected, backendURL);
      } catch (error) {
        console.error('❌ Error in network change callback:', error);
      }
    });
  }

  // Get current network status
  public getCurrentStatus() {
    return getNetworkStatus();
  }

  // Stop network monitoring
  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('📱 Network monitoring stopped');
  }

  // Restart network monitoring
  public restartMonitoring(): void {
    this.stopMonitoring();
    this.startNetworkMonitoring();
  }
}

// Export singleton instance
export const networkChangeHandler = NetworkChangeHandler.getInstance();

// Convenience functions
export const handleNetworkChangeAutomatically = () => networkChangeHandler.handleNetworkChange();
export const forceNetworkRediscovery = () => networkChangeHandler.forceNetworkRediscovery();
export const getCurrentNetworkStatus = () => networkChangeHandler.getCurrentStatus();
export const onNetworkChange = (callback: (isConnected: boolean, backendURL: string) => void) => 
  networkChangeHandler.onNetworkChange(callback);
export const offNetworkChange = (callback: (isConnected: boolean, backendURL: string) => void) => 
  networkChangeHandler.offNetworkChange(callback);
