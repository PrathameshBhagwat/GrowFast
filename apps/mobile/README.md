# GrowFast Mobile — Android and iOS Mobile POS

GrowFast Mobile is an offline-capable React Native application built with Expo SDK 52 and TypeScript, targeting Android and iOS devices from initial release.

---

## Architecture Overview

- **Framework**: Expo (SDK 52), React Native 0.76.7, React 18.3.1
- **Routing**: Expo Router (v4) with file-based routing
- **State & Data Fetching**: TanStack Query (React Query v5)
- **Local Persistence & Offline Cache**: Expo SQLite (schema migrations)
- **Secure Token Storage**: Expo SecureStore (encrypted keychain/keystore)
- **Network Awareness**: `@react-native-community/netinfo`
- **Shared Contracts**: Reuses `@growfast/shared-types` DTOs and enums
- **Forms**: React Hook Form

---

## Directory Structure

```
apps/mobile/
├── app/                      # Expo Router screens
│   ├── _layout.tsx           # Root app layout & QueryClientProvider
│   ├── (auth)/
│   │   └── login.tsx         # Staff login screen
│   └── (tabs)/
│       ├── _layout.tsx       # Bottom tab navigation
│       ├── index.tsx         # Dashboard / Home
│       ├── orders.tsx        # Orders list
│       └── settings.tsx      # Settings and logout
├── src/
│   ├── api/
│   │   └── client.ts         # Typed API client foundation
│   ├── components/
│   │   └── ConnectionBanner.tsx  # Network status banner
│   ├── db/
│   │   └── sqlite.ts         # SQLite database & migrations
│   ├── hooks/
│   │   └── useNetworkStatus.ts # Network status hook
│   └── storage/
│       └── secure-store.ts   # Secure token & session storage
├── app.json                  # Expo application configuration
├── metro.config.js           # Monorepo Metro bundler configuration
├── package.json              # Mobile workspace dependencies
└── tsconfig.json             # TypeScript configuration
```

---

## Development Prerequisites

1. **Node.js**: v20.0.0 or higher (v22.12.0 verified)
2. **Package Manager**: npm v11.6.2 (npm workspaces)
3. **Expo Go or Development Build**:
   - Install **Expo Go** from Google Play Store or iOS App Store for rapid prototyping, OR
   - Install **Android Studio** (Android SDK 34, Android Emulator) for Android development builds, OR
   - Install **Xcode** (macOS only) for iOS Simulator and device builds.

---

## Configuration

Set the environment variable `EXPO_PUBLIC_API_URL` to configure your backend API URL.

Example `.env` in `apps/mobile`:

```bash
# Android Emulator (points to host machine):
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000

# Physical device on local Wi-Fi:
# EXPO_PUBLIC_API_URL=http://192.168.1.100:3000

# iOS Simulator:
# EXPO_PUBLIC_API_URL=http://localhost:3000
```

> **Android Note:** When testing on a connected physical Android device via USB, run:
>
> ```bash
> adb reverse tcp:3000 tcp:3000
> ```
>
> This forwards requests from `localhost:3000` on the Android device directly to your machine's NestJS backend.

---

## Running in Development

From the monorepo root:

```bash
# Start the Expo development server:
npm run dev:mobile
# or inside apps/mobile:
cd apps/mobile && npm run start
```

Press:

- `a` to open in Android emulator
- `i` to open in iOS simulator
- `w` to open in web browser
- Scan the displayed QR code with the Expo Go app on your physical phone

---

## Building Native Development Builds

### Android (`.apk` / `.aab`)

To generate native Android builds locally without Expo Go:

1. Ensure `ANDROID_HOME` environment variable is set and Android SDK Platform 34 is installed.
2. Run prebuild:
   ```bash
   npx expo prebuild --platform android
   ```
3. Run or compile the debug APK:
   ```bash
   npx expo run:android
   ```
4. Or build a standalone release APK via Gradle:
   ```bash
   cd android && ./gradlew assembleRelease
   ```

### iOS (`.ipa` / Simulator)

> Requires macOS and Xcode.

1. Ensure Xcode Command Line Tools and CocoaPods are installed.
2. Run prebuild:
   ```bash
   npx expo prebuild --platform ios
   ```
3. Run the iOS build:
   ```bash
   npx expo run:ios
   ```

### Cloud Builds via EAS Build (Recommended for Production)

1. Install EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Configure build profiles: `eas build:configure`
4. Build Android: `eas build --platform android --profile preview`
5. Build iOS: `eas build --platform ios --profile preview`

---

## Idempotency and Offline Safety Contract

- **Client Draft Identifier (`clientDraftId`)**: Client generates a unique UUID for every new order. Re-submitting the draft with the same payload returns the created order idempotently. Conflicting reuses throw HTTP 409 Conflict.
- **Payment Idempotency Key (`idempotencyKey`)**: Payments use client-generated unique keys. Conflicting payments throw HTTP 409 Conflict.
- **Ambiguous Timeout Recovery**: If a network timeout occurs during submission, the client can query `GET /api/orders/by-draft/:draftId` to recover the authoritative order state safely before showing an error.
