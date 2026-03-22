# Offline Mesh Network Prototype

Android-first Expo development build prototype for offline multi-hop text chat using Google Nearby Connections and a custom Expo native module.

## Architecture

- `modules/expo-nearby-connections`: local Expo module with the Android Kotlin bridge for Nearby advertising, discovery, connection lifecycle, and byte payload exchange.
- `plugins/withNearbyConnections.js`: config plugin that injects Android permissions and Bluetooth feature flags during prebuild.
- `src/mesh/useMeshChat.ts`: relay logic in TypeScript with `messageId`, `ttl`, `hopCount`, a seen-message cache, and flooding to connected peers except the sender.
- `app/index.tsx`: single-screen debug UI for discovering peers, connecting, sending messages, and viewing logs.

## Run Locally

```bash
cd my-app
npm install
npm run prebuild:android
npm run android
npm start
```

Notes:

- Use a development build, not Expo Go.
- The `npm run android`, `npm run android:device`, and `npm run prebuild:android` scripts force the verified JDK 17 and Android SDK paths on this machine.
- `android/local.properties` now points Gradle at `/home/dejel/Android/sdk` for this workspace.
- Re-run `npm run prebuild:android` after changing native Kotlin or Android config/plugin code.
- Use `npm run android:device` to target a connected physical Android phone.
- Verified debug APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## Bundle A Standalone APK

Use this when you want the app to open without Metro or Wi-Fi access to your laptop.

```bash
cd my-app
npm run apk:release
```

APK output:

- `android/app/build/outputs/apk/release/app-release.apk`

Notes:

- This is the correct build for an offline demo. The release APK embeds the JS bundle.
- The debug development build at `android/app/build/outputs/apk/debug/app-debug.apk` still expects Metro.
- The generated release APK is signed with the debug keystore in this prototype, which is acceptable for local demo installs but not for production.

## 3-Device Demo Flow

1. On all three phones, install the development build and grant Nearby/Bluetooth permissions.
2. On device A, tap `Start Advertising`.
3. On device C, tap `Start Advertising`.
4. On device B, tap `Start Advertising`, then `Start Discovery`.
5. On device B, use the discovered endpoint list to connect to A and C.
6. On device A, send a message.
7. Confirm B logs `Payload received` and `Forwarded`.
8. Confirm C receives the same message with the UI label showing a lower `ttl` and higher `hopCount` than A's original send.
