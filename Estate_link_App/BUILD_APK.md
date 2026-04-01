# Building APK for device testing (hosted backend)

Your app uses **https://api.estatelink.cloud/** when `CURRENT_ENV` is `'PROD'` in `src/config/environment.ts` (already set).

## Why the APK wasn’t opening

- **Debug** builds were **skipping the JS bundle** and loading from Metro (localhost). On a real device the app couldn’t reach the dev server.
- **Fixes applied:** (1) `android/app/build.gradle` has `debuggableVariants = []` so the bundle is embedded in all builds. (2) `app.json` has `updates.enabled: false` so Expo Updates doesn’t run at launch. (3) `eas.json` has a `local` profile for APK.

## Build steps (from project root: `Estate_link_App`)

**Always run prebuild first** after changing `app.json` or plugins:

```bash
npx expo prebuild --platform android --clean
```

Then build the APK:

### Option A – Debug APK (faster, for testing)

```bash
cd android
./gradlew assembleDebug
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option B – Release APK (recommended for install on phone)

```bash
npm run build:apk:local
# or: bash fix-manifest.sh && cd android && ./gradlew assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

### One-liner from project root

```bash
npm run build:apk:debug   # debug APK (after prebuild)
npm run build:apk:local   # release APK (after prebuild)
```

### Alternative: EAS local build (uses `eas.json` profile `local`)

```bash
eas build --platform android --profile local --local
```

## Config summary

| File | What was set |
|------|----------------|
| `app.json` | `updates.enabled: false`, formatted; `googleServicesFile` and Android package unchanged |
| `eas.json` | Formatted; added `local` profile (APK, internal distribution) |
| `android/app/build.gradle` | `debuggableVariants = []` so bundle is embedded in debug and release |

## Gradle deprecation warning

*“Deprecated Gradle features were used in this build…”* is a warning only; the build is still **successful**. To list deprecations:

```bash
./gradlew assembleDebug --warning-mode all
```

## Install on phone

- **USB:** `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- **Manual:** Copy the APK to the device and install.

The app will use **https://api.estatelink.cloud/**; no Metro or localhost is required.
