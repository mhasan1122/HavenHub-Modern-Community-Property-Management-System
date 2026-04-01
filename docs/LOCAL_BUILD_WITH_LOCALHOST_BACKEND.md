# Building Locally and Testing with Localhost Backend

## ✅ Yes, It's Possible!

You can build your mobile app locally and connect it to a localhost backend. Here's how:

---

## Setup Options

### Option 1: Android Emulator (Easiest)
**Use:** `10.0.2.2:8000` (Android emulator's special IP for host machine)

### Option 2: Physical Device on Same Network
**Use:** Your machine's IP address (e.g., `192.168.0.219:8000`)

### Option 3: iOS Simulator
**Use:** `localhost:8000` or `127.0.0.1:8000`

---

## Step-by-Step Guide

### Step 1: Configure Backend URL

Edit `Estate_link_App/src/config/environment.ts`:

```typescript
// For Android Emulator
export const ENVIRONMENT = {
  DEV: {
    BACKEND_URL: 'http://10.0.2.2:8000',  // Android emulator
    // ... rest of config
  },
  LOCAL: {
    BACKEND_URL: 'http://10.0.2.2:8000',  // Android emulator
    // ... rest of config
  }
};

export const CURRENT_ENV = 'LOCAL';  // Use LOCAL environment
```

**OR for Physical Device:**
```typescript
export const ENVIRONMENT = {
  DEV: {
    BACKEND_URL: 'http://192.168.0.219:8000',  // Your machine's IP
    // ... rest of config
  }
};

export const CURRENT_ENV = 'DEV';
```

### Step 2: Start Backend Server

```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

**Important:** Use `0.0.0.0:8000` (not `localhost:8000`) so it's accessible from network devices.

### Step 3: Build Locally

#### For Android:
```bash
cd Estate_link_App

# Prebuild (generates native code)
npx expo prebuild

# Run on Android emulator
npx expo run:android

# OR build APK
npx expo run:android --variant release
```

#### For iOS:
```bash
cd Estate_link_App

# Prebuild
npx expo prebuild

# Run on iOS simulator
npx expo run:ios
```

---

## Configuration by Device Type

### Android Emulator
```typescript
BACKEND_URL: 'http://10.0.2.2:8000'
```
- `10.0.2.2` is Android emulator's special IP for host machine
- Works automatically, no network setup needed

### Physical Android Device
```typescript
BACKEND_URL: 'http://YOUR_MACHINE_IP:8000'
```
- Find your IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- Both devices must be on same WiFi network
- Example: `http://192.168.0.219:8000`

### iOS Simulator
```typescript
BACKEND_URL: 'http://localhost:8000'
```
- Simulator runs on same machine, so `localhost` works

### Physical iOS Device
```typescript
BACKEND_URL: 'http://YOUR_MACHINE_IP:8000'
```
- Same as Android physical device

---

## Quick Setup Guide

### 1. Find Your Machine's IP Address

**Mac/Linux:**
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

**Windows:**
```bash
ipconfig
# Look for IPv4 Address under your network adapter
```

### 2. Update Environment Config

```typescript
// Estate_link_App/src/config/environment.ts

export const ENVIRONMENT = {
  LOCAL: {
    BACKEND_URL: 'http://10.0.2.2:8000',  // For Android emulator
    // OR
    BACKEND_URL: 'http://192.168.0.219:8000',  // For physical device
    API_TIMEOUT: 5000,
    RETRY_ATTEMPTS: 2,
    RETRY_DELAY: 500,
    AUTO_DISCOVERY: true,
    NETWORK_CHECK_INTERVAL: 15000,
  }
};

export const CURRENT_ENV = 'LOCAL';
```

### 3. Start Backend
```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

### 4. Build and Run App
```bash
cd Estate_link_App
npx expo prebuild
npx expo run:android  # or run:ios
```

---

## Testing Connection

### Test Backend is Accessible

**From Browser:**
- Android Emulator: `http://10.0.2.2:8000`
- Physical Device: `http://YOUR_IP:8000` (from your computer's browser)

**From App:**
The app has built-in connection testing. Check console logs for:
```
✅ Backend server found at: http://10.0.2.2:8000
```

### Test API Endpoint
```bash
# From your computer
curl http://localhost:8000/api/notifications/

# Should return JSON response
```

---

## Troubleshooting

### Issue: Connection Timeout

**Solution 1: Check Backend is Running**
```bash
# Should see Django server running
python manage.py runserver 0.0.0.0:8000
```

**Solution 2: Check Firewall**
- Windows: Allow port 8000 in Windows Firewall
- Mac: System Preferences → Security → Firewall

**Solution 3: Verify IP Address**
```bash
# Make sure you're using correct IP
# For emulator: 10.0.2.2
# For physical device: Your machine's actual IP
```

### Issue: CORS Errors

**Backend Settings:**
```python
# backend/backend/settings.py
CORS_ALLOW_ALL_ORIGINS = True  # ✅ Already set
```

### Issue: Cleartext Traffic (Android)

**Already Configured:**
```json
// app.json
{
  "expo-build-properties": {
    "android": {
      "usesCleartextTraffic": true  // ✅ Already set
    }
  }
}
```

---

## Current Configuration Status

### ✅ Already Configured:
- Environment config file exists
- Network discovery enabled
- Cleartext traffic allowed (Android)
- CORS enabled (backend)

### ⚠️ Need to Update:
- Set `CURRENT_ENV` to `'LOCAL'` or `'DEV'`
- Update `BACKEND_URL` based on device type
- Use `0.0.0.0:8000` for backend server

---

## Example Configurations

### For Android Emulator:
```typescript
export const CURRENT_ENV = 'LOCAL';

export const ENVIRONMENT = {
  LOCAL: {
    BACKEND_URL: 'http://10.0.2.2:8000',
    // ... rest
  }
};
```

### For Physical Device:
```typescript
export const CURRENT_ENV = 'DEV';

export const ENVIRONMENT = {
  DEV: {
    BACKEND_URL: 'http://192.168.0.219:8000',  // Your IP
    // ... rest
  }
};
```

---

## Summary

✅ **Yes, you can build locally and test with localhost backend!**

**Quick Steps:**
1. Update `environment.ts` with correct backend URL
2. Start backend: `python manage.py runserver 0.0.0.0:8000`
3. Build app: `npx expo prebuild && npx expo run:android`
4. Test connection - should work!

**Device-Specific URLs:**
- Android Emulator: `http://10.0.2.2:8000`
- Physical Device: `http://YOUR_IP:8000`
- iOS Simulator: `http://localhost:8000`

Your app already has network discovery, so it will try to find the backend automatically! 🎉
