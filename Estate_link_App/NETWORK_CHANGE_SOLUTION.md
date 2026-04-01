# Network Change Solution

This solution automatically handles network changes and backend server discovery to resolve the "Network request failed" error when switching between networks.

## 🚀 Features

- **Automatic Backend Discovery**: Automatically finds your backend server when the network changes
- **Network Change Detection**: Monitors network changes and handles them automatically
- **Fallback Mechanisms**: Multiple fallback strategies to ensure connectivity
- **Real-time Status**: Live network status monitoring and display
- **Manual Override**: Manual network change handling when needed

## 🔧 How It Works

### 1. Automatic Discovery
When a network change is detected, the system:
- Tests the configured backend URL
- Scans common IP addresses (192.168.0.*, 192.168.1.*, etc.)
- Tests different ports (8000, 3000, 5000, etc.)
- Updates the API configuration automatically

### 2. Network Monitoring
- Checks network status every 30 seconds
- Detects when network changes occur
- Automatically handles reconnection
- Provides real-time status updates

### 3. Fallback Strategy
1. Try configured URL first
2. Test common router IPs
3. Scan current network subnet
4. Try different ports on known IPs
5. Fall back to configured URL

## 📱 Usage

### Basic Usage in Components

```tsx
import { useNetworkChange } from '../hooks/useNetworkChange';

const MyComponent = () => {
  const { 
    networkStatus, 
    isHandlingChange, 
    handleNetworkChange, 
    forceRediscovery 
  } = useNetworkChange();

  // Network status is automatically updated
  console.log('Connected:', networkStatus.isConnected);
  console.log('Backend IP:', networkStatus.lastKnownIP);
  console.log('Retry count:', networkStatus.retryCount);

  return (
    <View>
      <Text>Status: {networkStatus.isConnected ? 'Connected' : 'Disconnected'}</Text>
      <Button 
        title="Handle Network Change" 
        onPress={handleNetworkChange}
        disabled={isHandlingChange}
      />
    </View>
  );
};
```

### Using the Network Status Indicator

```tsx
import { NetworkStatusIndicator } from '../components/NetworkStatusIndicator';

const MyScreen = () => {
  return (
    <View>
      <Text>My App Content</Text>
      
      {/* Add this anywhere in your app to show network status */}
      <NetworkStatusIndicator />
    </View>
  );
};
```

### Manual Network Change Handling

```tsx
import { handleNetworkChangeAutomatically, forceNetworkRediscovery } from '../utils/networkChangeHandler';

// Handle network change manually
const handleNetworkIssue = async () => {
  try {
    const success = await handleNetworkChangeAutomatically();
    if (success) {
      console.log('Network change handled successfully!');
    } else {
      console.log('Failed to handle network change');
    }
  } catch (error) {
    console.error('Error handling network change:', error);
  }
};

// Force network rediscovery
const forceRediscovery = async () => {
  try {
    const success = await forceNetworkRediscovery();
    if (success) {
      console.log('Network rediscovery successful!');
    } else {
      console.log('Network rediscovery failed');
    }
  } catch (error) {
    console.error('Error during rediscovery:', error);
  }
};
```

## ⚙️ Configuration

### Environment Settings

The system automatically adapts based on your environment configuration:

```typescript
// In src/config/environment.ts
export const ENVIRONMENT = {
  DEV: {
    BACKEND_URL: 'http://192.168.0.185:8000', // Your current backend
    AUTO_DISCOVERY: true,                      // Enable auto-discovery
    NETWORK_CHECK_INTERVAL: 30000,            // Check every 30 seconds
    RETRY_ATTEMPTS: 3,                        // Retry 3 times
  },
  // ... other environments
};
```

### Customizing Fallback IPs

To add more fallback IP addresses, update the `getFallbackURLs()` function:

```typescript
export const getFallbackURLs = (): string[] => {
  return [
    'http://192.168.0.185:8000', // Your primary backend
    'http://192.168.0.1:8000',   // Router
    'http://192.168.1.1:8000',   // Alternative router
    'http://10.0.0.1:8000',      // Different subnet
    'http://localhost:8000',      // Local development
    // Add more IPs as needed
  ];
};
```

## 🔍 Debugging

### View Network Status

```typescript
import { getNetworkStatus } from '../utils/networkUtils';

const status = getNetworkStatus();
console.log('Network Status:', status);
```

### Enable Detailed Logging

The system provides detailed console logs with emojis for easy identification:

- 🔍 Discovery operations
- ✅ Successful operations
- ❌ Failed operations
- 🔄 Network changes
- 📱 App notifications

### Common Log Messages

```
🔍 Starting backend server discovery...
📱 Using configured backend URL: http://192.168.0.185:8000
🔍 Testing common IP addresses...
🔍 Testing IP: 192.168.0.185
❌ IP 192.168.0.185 not accessible
🔍 Testing IP: 192.168.0.1
✅ Backend server found at: 192.168.0.1
🔄 Network change detected, handling automatically...
✅ Network change handled successfully
```

## 🚨 Troubleshooting

### If Auto-Discovery Fails

1. **Check Network Permissions**: Ensure your app has network access
2. **Verify Backend Server**: Make sure your Django backend is running
3. **Check Firewall**: Ensure port 8000 is accessible
4. **Manual Rediscovery**: Use the `forceRediscovery()` function

### Common Issues

1. **"Network request failed" still appears**
   - The system will automatically retry and discover new IPs
   - Check console logs for discovery progress
   - Use manual network change handling if needed

2. **Slow network discovery**
   - Discovery timeouts are configurable
   - Reduce timeout values for faster discovery
   - Use manual rediscovery for immediate results

3. **Backend not found**
   - Verify backend server is running
   - Check if backend is on a different port
   - Ensure backend is accessible from your device

## 🔄 Integration with Existing Code

The solution is designed to work seamlessly with your existing code:

- **No Breaking Changes**: All existing API calls continue to work
- **Automatic Updates**: API configuration updates automatically
- **Transparent Operation**: Network handling happens in the background
- **Easy Rollback**: Can be disabled by setting `AUTO_DISCOVERY: false`

## 📋 Summary

This solution provides:

✅ **Automatic network change handling**
✅ **Backend server discovery**
✅ **Multiple fallback strategies**
✅ **Real-time status monitoring**
✅ **Manual override capabilities**
✅ **Easy integration**
✅ **Comprehensive logging**

When you change networks, the system will automatically:
1. Detect the network change
2. Discover your backend server on the new network
3. Update the API configuration
4. Resume normal operation

No more manual IP configuration or "Network request failed" errors!
