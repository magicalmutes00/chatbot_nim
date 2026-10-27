# Trisentric AI — mobile client (`chatbot_nim`)

Bare React Native (CLI) client for the Aurora/Trisentric backend. It streams
replies from the Fastify API in `../personal-ai-assistant`, which holds the
NVIDIA NIM key, Neon Postgres history, S3 files, memory, and tasks.

## Requirements

- Node 20+, npm
- Android Studio + SDK (Android), or Xcode + CocoaPods on macOS (iOS)
- The backend running on port `8787` (see `../personal-ai-assistant/README.md`)

## 1. Install

```bash
npm install

# iOS only
cd ios && pod install && cd ..
```

`react-native-image-picker` is a native module: after installing, rebuild the
Android/iOS app (Metro alone is not enough). On iOS the photo-library prompt
text lives in `ios/NimChatApp/Info.plist`
(`NSPhotoLibraryUsageDescription`).

## 2. Configure Firebase Auth

The app uses the Firebase project `nimchatapp-90bc8` for email/password and
Google Sign-In. In Firebase → Authentication → Sign-in method enable
**Email/Password** and **Google**.

- Android: `android/app/google-services.json` (already present)
- iOS: `ios/NimChatApp/GoogleService-Info.plist` (already present, add it to the
  `NimChatApp` target in Xcode if it isn't listed there)

Then copy the environment file and fill in the OAuth **Web** client id (public
identifier, found in Firebase → Project settings → General, or as
`"client_type": 3` in `google-services.json`):

```bash
cp .env.example .env
# GOOGLE_WEB_CLIENT_ID=927019487925-...apps.googleusercontent.com
```

`react-native-config` is wired into `android/app/build.gradle`; rebuild the
native app after changing `.env`.

iOS also needs the reversed client id as a URL scheme. It is already declared in
`ios/NimChatApp/Info.plist` as
`com.googleusercontent.apps.927019487925-rh96075ljq5nlmsbhistktkb6ehlqm9e`.
Replace it if you point at a different Firebase project.

## 3. Point at the backend

Defaults:

- Android emulator: `http://10.0.2.2:8787`
- iOS simulator: `http://localhost:8787`

For a physical device, set `BACKEND_URL` in `.env` to the machine's LAN address:

```bash
BACKEND_URL=http://192.168.1.20:8787
```

Debug Android builds allow cleartext HTTP for the local API. A release build
needs an HTTPS `BACKEND_URL`.

## 4. Run

```bash
npm start          # Metro on 8082
npm run android    # or: npm run ios
```

## How auth and data flow

- `src/contexts/AuthContext.tsx` wraps React Native Firebase
  (`onAuthStateChanged`, email/password, reset mail) and exchanges a Google ID
  token with `signInWithCredential`.
- Every API call attaches `Authorization: Bearer <Firebase ID token>`:
  `src/api/backend.ts` exposes `backendFetch` for REST and `authHeaders` for the
  streaming `XMLHttpRequest` in `src/api/nimClient.ts`.
- The first chat turn creates the conversation server-side; the client adopts
  `conversationId` from the `start` SSE event so later turns append to the same
  chat. History is polled from `/api/conversations/:id/messages`.
- Image models (`black-forest-labs/flux.1-dev`) post to
  `/api/images/generate`; the backend renders, stores the JPEG in S3, and
  returns a presigned URL plus the conversation id. Choose 1:1, 16:9, or 9:16
  with the ratio chips above the composer.
- The composer's **+** button attaches one photo: the picker hands the client
  base64 (max 1600 px, JPEG quality 0.8), the client presigns
  `/api/attachments/upload-url`, PUTs the bytes to S3, and sends the returned
  key with the turn. Selecting a photo switches to a vision model
  automatically (Nemotron Super VL 120B or MiniMax M3.1 Flash), and the image
  reappears in history through the conversation poll. Removing an attachment
  before sending leaves its uploaded object orphaned in S3 (same as the web
  composer).
- Voice, memories, and tasks live in the web/desktop client for now; the mobile
  catalog exposes the chat, vision, and image models.

## Scripts

```bash
npm start       # Metro
npm run android
npm run ios
npm run lint
npm test
```
