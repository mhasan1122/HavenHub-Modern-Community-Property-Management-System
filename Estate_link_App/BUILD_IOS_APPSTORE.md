# Build EstateLink iOS App for App Store Release

This guide covers building and submitting the EstateLink Expo app to the Apple App Store using EAS Build and EAS Submit.

## Prerequisites

- **Apple Developer Program** membership (required for App Store distribution).
- **App Store Connect**: App created with bundle ID `com.estatelink.estateapp` (must match `app.json`).
- **EAS CLI** installed and logged in:
  ```bash
  npm install -g eas-cli
  eas login
  ```
- **Local credentials** (already in repo): `Certificates.p12`, `EstateLink_iOS_AppStore.mobileprovision`, and `credentials.json` pointing to them. The production profile is set to use these (`credentialsSource: "local"`).

## 1. Bump version (optional)

Edit `Estate_link_App/app.json` and update:

- `expo.version` — user-facing version (e.g. `1.3.13`).
- EAS will auto-increment the iOS build number when using the production profile.

## 2. Build for App Store

From the **Estate_link_App** directory:

```bash
cd Estate_link_App
npm run build:ios:production
```

Or directly:

```bash
eas build --profile production --platform ios
```

- Build runs on **EAS servers** (recommended). You’ll get a link to the build page; when it finishes, the `.ipa` is ready for submit.
- To build on your Mac instead (requires Xcode and same credentials):
  ```bash
  npm run build:ios:production:local
  # or: eas build --profile production --platform ios --local
  ```

## 3. Submit to App Store Connect

After a production iOS build completes:

```bash
npm run submit:ios
# or: eas submit --platform ios --latest
```

- This submits the **latest** production iOS build. To pick a specific build:
  ```bash
  eas submit --platform ios --id <BUILD_ID>
  ```
- First time: EAS may ask for your **App Store Connect API key** or **Apple ID** for App Store Connect. Configure once; later submits reuse it.

## 4. In App Store Connect

1. Open [App Store Connect](https://appstoreconnect.apple.com) → your app.
2. The new build will appear under **TestFlight** and then under **App Store** when you add it to a version.
3. Complete **version information**, **screenshots**, **description**, **privacy**, etc. if not already done.
4. Submit the version for **App Review**.

## Credentials

- **Current setup**: Production iOS uses **local** credentials (`eas.json` → `production.ios.credentialsSource: "local"`). The app uses `credentials.json`, `Certificates.p12`, and `EstateLink_iOS_AppStore.mobileprovision` in this folder.
- **Use EAS-managed credentials instead**: In `eas.json`, set `production.ios.credentialsSource` to `"remote"`, then run:
  ```bash
  eas credentials --platform ios
  ```
  and follow the prompts to create/store distribution certificate and provisioning profile.

## Quick reference

| Task              | Command |
|-------------------|--------|
| Build (cloud)     | `npm run build:ios:production` |
| Build (local)     | `npm run build:ios:production:local` |
| Submit latest     | `npm run submit:ios` |
| Submit by ID      | `eas submit --platform ios --id <BUILD_ID>` |

## Troubleshooting

- **“No credentials”**: Ensure `Certificates.p12`, `EstateLink_iOS_AppStore.mobileprovision`, and `credentials.json` are in `Estate_link_App` and the bundle ID in the provisioning profile is `com.estatelink.estateapp`.
- **Build fails on EAS**: Check the build log on expo.dev; common issues are missing env vars, wrong Node/Xcode image, or native module (e.g. Firebase) config. Ensure `GoogleService-Info.plist` is committed and path in `app.json` is correct.
- **Submit “build not found”**: Run `eas build:list --platform ios` and use the correct build ID with `eas submit --platform ios --id <BUILD_ID>`.
