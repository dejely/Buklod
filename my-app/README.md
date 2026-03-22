# Offline Hub Mesh Prototype

Android-first Expo development-build prototype for an offline hub-based mesh chat using Google Nearby Connections as the only transport layer.

## What It Does

- Creates or discovers nearby logical hubs
- Uses Google Nearby Connections for direct advertising, discovery, connection, and payload exchange
- Keeps hub and multi-hop relay logic in TypeScript
- Relays hub messages across multiple hops with TTL and de-duplication
- Runs on Android through an Expo development build, not Expo Go

## Architecture

- `modules/expo-nearby-connections`
  - Local Expo native module
  - Kotlin wrapper around Google Nearby Connections
- `plugins/withNearbyConnections.js`
  - Adds Android permissions and manifest entries needed for Nearby
- `src/hub/nearbyTransport.ts`
  - Typed TS wrapper around the native module and runtime permission requests
- `src/hub/hubManager.ts`
  - Hub creation, discovery metadata parsing, and discovered-hub state helpers
- `src/hub/meshRelay.ts`
  - Multi-hop message parsing, TTL, hop count, forwarding, and dedupe decisions
- `src/hub/messageStore.ts`
  - In-memory seen-message cache, logs, and per-hub message storage
- `src/hub/useNearbyEvents.ts`
  - Wires native Nearby events into React state handlers
- `src/hub/useHubMesh.ts`
  - Main hub state machine used by the UI
- `app/index.tsx`
  - Single-screen hub UI

## Payloads

Advertised hub metadata:

```json
{
  "type": "HUB_ANNOUNCE",
  "hubId": "string",
  "hubName": "string",
  "creatorNodeId": "string",
  "createdAt": 0,
  "nodeId": "string"
}
```

Hub chat message:

```json
{
  "type": "HUB_MESSAGE",
  "messageId": "uuid",
  "hubId": "string",
  "originNodeId": "string",
  "currentSenderNodeId": "string",
  "senderName": "string",
  "text": "string",
  "createdAt": 0,
  "ttl": 4,
  "hopCount": 0
}
```

Optional sync request and response:

```json
{
  "type": "HUB_SYNC_REQUEST",
  "hubId": "string",
  "requestNodeId": "string",
  "sinceTimestamp": 0
}
```

```json
{
  "type": "HUB_SYNC_RESPONSE",
  "hubId": "string",
  "messages": []
}
```

## Android Setup

This project uses a helper script so Gradle resolves the correct local JDK and Android SDK paths.

### Install dependencies

```bash
cd /home/dejel/Documents/GitHub/OfflineMeshNetwork/my-app
npm install
```

### Generate Android project

```bash
cd /home/dejel/Documents/GitHub/OfflineMeshNetwork/my-app
npm run prebuild:android
```

### Build and run the Android development build

```bash
cd /home/dejel/Documents/GitHub/OfflineMeshNetwork/my-app
npm run android
```

For a USB-connected physical device:

```bash
cd /home/dejel/Documents/GitHub/OfflineMeshNetwork/my-app
npm run android:device
```

### Start Metro for the development build

```bash
cd /home/dejel/Documents/GitHub/OfflineMeshNetwork/my-app
npm start
```

### Build a bundled APK

This APK embeds the JS bundle, so it can launch without needing the Metro server.

```bash
cd /home/dejel/Documents/GitHub/OfflineMeshNetwork/my-app
npm run apk:release
```

Output:

- `android/app/build/outputs/apk/release/app-release.apk`

## Notes About Offline Testing

- Nearby Connections works without internet, but it may still use Bluetooth and Wi-Fi radios under the hood.
- For the development build, the app shell still needs Metro unless you install the bundled release APK.
- For local testing, keep Bluetooth enabled.
- In practice, keep Wi-Fi enabled too even if the phones are not using the internet.

## 3-Device Manual Test

1. Install the Android build on devices A, B, and C.
2. On all three devices, grant the requested Nearby, Bluetooth, and location permissions.
3. On device A, tap `Start Mesh`.
4. On device A, enter `Team Alpha` and tap `Create Hub`.
5. On device B, tap `Start Mesh`, then `Discover Hubs`.
6. When `Team Alpha` appears, tap `Join Hub`.
7. Verify device B now shows the current hub and continues advertising and discovery.
8. On device C, tap `Start Mesh`, then `Discover Hubs`.
9. Join `Team Alpha` on C if it is discoverable, or at minimum keep C near B so B can relay hub traffic onward.
10. On device A, send a hub message.
11. Verify device B logs that it received and forwarded the message.
12. Verify device C receives the same hub message with `hopCount > 0`.

## MVP Shortcuts

- Android only
- No persistence
- No encryption
- No file transfer
- In-memory seen-message cache only
- Simple flooding relay with TTL instead of route optimization
- Hub metadata is packed into the Nearby advertised endpoint name for the fastest prototype path

## Figma Note

The UI was adapted to the requested hub workflow, but exact Figma extraction was blocked by the current Figma MCP tool-call limit during implementation.
