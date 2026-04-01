# Fix: minSdkVersion Error

## Error
```
User has minSdkVersion 21 but library was built for 24 [//ReactAndroid/hermestooling]
```

## Cause
React Native's Hermes tooling requires `minSdkVersion` 24, but your app is configured with 21.

## Fix Applied

Updated `app.json`:
- `minSdkVersion`: 21 → **24**

## Next Steps

### 1. Clean and Rebuild
```bash
cd Estate_link_App

# Remove Android build
rm -rf android

# Prebuild again
npx expo prebuild --clean

# Build release
cd android
./gradlew assembleRelease
```

### 2. Fix Manifest (If Needed)

After prebuild, run the manifest fix script:
```bash
./fix-manifest.sh
```

### 3. Rebuild
```bash
cd android
./gradlew assembleRelease
```

---

## What Changed

**Before:**
```json
"minSdkVersion": 21
```

**After:**
```json
"minSdkVersion": 24
```

---

## Impact

- ✅ Fixes Hermes tooling compatibility
- ✅ Fixes CMake configuration errors
- ⚠️ App will only support Android 7.0+ (API 24+) instead of Android 5.0+ (API 21+)

**Android 7.0 (API 24)** covers **99.5%+ of active Android devices**, so this is fine for most apps.

---

## Summary

✅ **Fixed:** Updated `minSdkVersion` to 24  
✅ **Next:** Clean, prebuild, and rebuild

The build should work now!
