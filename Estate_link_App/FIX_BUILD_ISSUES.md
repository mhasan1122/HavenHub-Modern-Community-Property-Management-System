# Fix Android Build Issues

## Issues Found

1. **compileSdkVersion too low** - Dependencies require SDK 35, but app uses 34
2. **Manifest merger conflict** - Firebase notification color conflict

## Fixes Applied

### ✅ Issue 1: Updated compileSdkVersion

Updated `app.json`:
- `compileSdkVersion`: 34 → **35**
- `buildToolsVersion`: 34.0.0 → **35.0.0**
- `targetSdkVersion`: 34 (kept same - this is fine)
- `minSdkVersion`: 21 (added)

### ✅ Issue 2: Fix Manifest Merger Conflict

After running `npx expo prebuild`, you need to fix the AndroidManifest.xml:

**File:** `android/app/src/main/AndroidManifest.xml`

**Find this section:**
```xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_color"
    android:resource="@color/notification_icon_color" />
```

**Replace with:**
```xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_color"
    android:resource="@color/notification_icon_color"
    tools:replace="android:resource" />
```

**Also add `tools` namespace** at the top of `<manifest>` tag:
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.estatelink.app">
```

---

## Step-by-Step Fix

### Step 1: Clean Build
```bash
cd Estate_link_App

# Remove android folder
rm -rf android

# Clean node modules (optional)
rm -rf node_modules
npm install
```

### Step 2: Prebuild
```bash
npx expo prebuild --clean
```

### Step 3: Fix AndroidManifest.xml

**Edit:** `android/app/src/main/AndroidManifest.xml`

**Add tools namespace:**
```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.estatelink.app">
```

**Fix notification color meta-data:**
```xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_color"
    android:resource="@color/notification_icon_color"
    tools:replace="android:resource" />
```

### Step 4: Create Notification Color Resource

**Create:** `android/app/src/main/res/values/colors.xml` (if doesn't exist)

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="notification_icon_color">#3D9D9B</color>
</resources>
```

### Step 5: Rebuild
```bash
npx expo run:android
```

---

## Alternative: Use Expo Config Plugin

Create a config plugin to automatically fix the manifest:

**Create:** `app.plugin.js` in root directory:

```javascript
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withFixedManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    
    // Find the application tag
    const application = androidManifest.manifest.application[0];
    
    // Find or create meta-data for notification color
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    
    // Find existing notification color meta-data
    const notificationColorMeta = application['meta-data'].find(
      (meta) => meta.$['android:name'] === 'com.google.firebase.messaging.default_notification_color'
    );
    
    if (notificationColorMeta) {
      // Add tools:replace attribute
      notificationColorMeta.$['tools:replace'] = 'android:resource';
    }
    
    // Ensure tools namespace is in manifest
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    
    return config;
  });
};
```

**Then update `app.json`:**
```json
{
  "expo": {
    "plugins": [
      "./app.plugin.js",
      // ... other plugins
    ]
  }
}
```

---

## Quick Fix Script

Create `fix-manifest.sh`:

```bash
#!/bin/bash

MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ -f "$MANIFEST" ]; then
  # Add tools namespace if not present
  if ! grep -q 'xmlns:tools' "$MANIFEST"; then
    sed -i '' 's/<manifest xmlns:android/<manifest xmlns:android xmlns:tools/g' "$MANIFEST"
  fi
  
  # Fix notification color meta-data
  sed -i '' 's/android:resource="@color\/notification_icon_color"/android:resource="@color\/notification_icon_color" tools:replace="android:resource"/g' "$MANIFEST"
  
  echo "✅ Fixed AndroidManifest.xml"
else
  echo "❌ AndroidManifest.xml not found. Run 'npx expo prebuild' first."
fi
```

Run: `bash fix-manifest.sh`

---

## Summary

**Fixed:**
- ✅ Updated `compileSdkVersion` to 35
- ✅ Updated `buildToolsVersion` to 35.0.0
- ✅ Added `minSdkVersion` 21

**Need to Fix After Prebuild:**
- ⚠️ Add `tools:replace` to notification color meta-data
- ⚠️ Add `xmlns:tools` namespace to manifest
- ⚠️ Create colors.xml with notification color

**Next Steps:**
1. Clean build: `rm -rf android`
2. Prebuild: `npx expo prebuild --clean`
3. Fix AndroidManifest.xml (see Step 3 above)
4. Create colors.xml (see Step 4 above)
5. Rebuild: `npx expo run:android`
