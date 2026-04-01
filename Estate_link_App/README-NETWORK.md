# Network Configuration Guide

## Overview
This guide explains how to configure the network connection between your React Native app and Django backend server.

## Current Configuration
- **Backend Server**: Django running on `http://0.0.0.0:8000`
- **Your Machine IP**: `192.168.0.185`
- **App Configuration**: Set to use `http://192.168.0.185:8000`

## Quick Fix
The main issue was that your app was trying to connect to `192.168.0.219:8000` which is not reachable. This has been fixed by updating the configuration to use your current machine's IP address.

## Environment Configuration
The app now uses an environment-based configuration system located in `src/config/environment.ts`:

```typescript
export const ENVIRONMENT = {
  DEV: {
    BACKEND_URL: 'http://192.168.0.185:8000',  // Current setup
    API_TIMEOUT: 10000,
    RETRY_ATTEMPTS: 1,
    RETRY_DELAY: 1000,
  },
  LOCAL: {
    BACKEND_URL: 'http://localhost:8000',       // Same machine
    API_TIMEOUT: 5000,
    RETRY_ATTEMPTS: 1,
    RETRY_DELAY: 500,
  }
};
```

## How to Change Backend URL

### Option 1: Update Environment File
Edit `src/config/environment.ts` and change the `CURRENT_ENV` variable:
```typescript
export const CURRENT_ENV = 'LOCAL';  // For localhost
// or
export const CURRENT_ENV = 'DEV';    // For network IP
```

### Option 2: Update IP Address
If your machine's IP changes, update the `DEV` configuration:
```typescript
DEV: {
  BACKEND_URL: 'http://YOUR_NEW_IP:8000',
  // ... other settings
}
```

## Testing Connection

### Using the Test Script
Run the connection test script to verify connectivity:
```bash
node scripts/test-connection.js
```

### Manual Testing
Test these URLs in your browser:
- `http://192.168.0.185:8000` - Network access
- `http://localhost:8000` - Local access
- `http://127.0.0.1:8000` - Local access

## Troubleshooting

### Issue: Connection Timeout
**Symptoms**: App shows "Server response timeout" or "Connection timeout"
**Solutions**:
1. Verify Django server is running: `python manage.py runserver 0.0.0.0:8000`
2. Check firewall settings on Windows
3. Ensure both devices are on the same network
4. Try using `localhost` if testing on the same machine

### Issue: Network Request Failed
**Symptoms**: App shows "Network request failed" or "Unable to reach server"
**Solutions**:
1. Check internet connectivity
2. Verify Django server is accessible from browser
3. Check CORS settings in Django
4. Ensure `ALLOWED_HOSTS = ['*']` in Django settings

### Issue: IP Address Changed
**Symptoms**: App was working but suddenly stopped
**Solutions**:
1. Find your new IP: `Get-NetIPAddress` in PowerShell
2. Update the environment configuration
3. Restart the React Native app

## Django Server Configuration

### Starting the Server
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

### Important Settings
In `backend/backend/settings.py`:
```python
ALLOWED_HOSTS = ['*']  # Allows connections from any IP
CORS_ALLOW_ALL_ORIGINS = True  # Allows CORS from any origin
```

## React Native App Configuration

### Network Utilities
The app automatically discovers the backend server using multiple methods:
1. **Environment Configuration**: Uses the configured URL first
2. **IP Discovery**: Scans common network IPs
3. **Fallback**: Uses the configured URL as fallback

### Timeout Settings
- **Development**: 10 seconds (configurable)
- **Local**: 5 seconds (faster for same machine)
- **Production**: 15 seconds (more reliable)

## Best Practices

1. **Development**: Use `DEV` environment with your machine's IP
2. **Local Testing**: Use `LOCAL` environment with `localhost`
3. **Production**: Update `PROD` environment with your domain
4. **IP Changes**: Update environment file when network changes
5. **Testing**: Always test connection before deploying

## Support
If you continue to have issues:
1. Check the connection test script output
2. Verify Django server is running and accessible
3. Check Windows Firewall settings
4. Ensure both devices are on the same network
5. Try using `localhost` for same-machine testing
