# NimChatApp — starter code

This is the JS/TS source layer for the app described in the spec: a bare React
Native (CLI, not Expo) app that chats with NVIDIA NIM models and persists
history per-user in Firebase.

**This bundle is source files only** — it does not include the native
`ios/`/`android/` project folders, since generating and building those
requires the React Native CLI, Xcode/CocoaPods, and the Android SDK, none of
which are available in the environment that generated this code. Follow the
steps below on your own machine to get a runnable project.

## 1. Initialize the native project

```bash
npx @react-native-community/cli init NimChatApp --template react-native-template-typescript
cd NimChatApp
```

Then copy everything from this bundle (`App.tsx`, `src/`, `firestore.rules`,
`.env.example`) into the freshly generated project, overwriting the
placeholder `App.tsx`.

## 2. Install dependencies

```bash
npm install @react-navigation/native @react-navigation/native-stack \
  react-native-screens react-native-safe-area-context react-native-gesture-handler \
  @react-native-firebase/app @react-native-firebase/auth @react-native-firebase/firestore \
  zustand react-native-config

cd ios && pod install && cd ..
```

## 3. Wire up native Firebase

1. Create a Firebase project (or reuse one), enable **Email/Password** auth
   under Authentication → Sign-in method, and create a Firestore database.
2. Download `google-services.json` from the Firebase console and place it at
   `android/app/google-services.json`.
3. Download `GoogleService-Info.plist` and add it to the Xcode project (drag
   into the `ios/NimChatApp` group in Xcode so it's included in the target).
4. Follow the RNFirebase native install steps for both platforms (Gradle
   plugin + `google-services` classpath on Android, pod install already done
   for iOS): https://rnfirebase.io/

## 4. Add your NVIDIA API key

```bash
cp .env.example .env
# edit .env and paste your key
```

`.env` is already covered by the default RN `.gitignore` pattern for
dotfiles — double check it's actually listed before committing.

You'll also need `react-native-config`'s native setup (Android: apply its
Gradle plugin in `android/app/build.gradle`; iOS: add the Config build phase)
per https://github.com/lugg/react-native-config#setup — this is required for
`Config.NVIDIA_API_KEY` to resolve at runtime.

## 5. Deploy Firestore rules

```bash
firebase deploy --only firestore:rules
```

(requires the Firebase CLI and `firebase init` pointing at this project, or
paste `firestore.rules` directly into the console's Rules tab)

## 6. Run it

```bash
npx react-native run-ios
# or
npx react-native run-android
```

## What's included vs. what's left

**Included (this bundle):**
- Email/password auth (login, signup, forgot password) via native RNFirebase
- Auth-gated navigation (Auth stack vs Main stack)
- Chat list screen (create, open, delete via long-press)
- Chat screen: message bubbles, streaming assistant replies, model picker,
  collapsible reasoning display
- `nimClient.ts`: direct-from-client NIM streaming call with SSE parsing
- Firestore read/write layer (`firestoreChats.ts`) matching the spec's data
  model, plus `firestore.rules`
- Zustand store for in-flight streaming UI state

**Left for you / flagged in comments:**
- **RN streaming**: `nimClient.ts` streams via XMLHttpRequest incremental
  delivery (`xhr.onprogress`), which works on every RN/Hermes version — no
  dependency on `fetch` exposing a readable `response.body`. If you ever swap
  back to fetch-based streaming, test early; that was the riskiest
  native-platform assumption in the original spec.
- Partial assistant replies are now persisted when a stream errors or is
  aborted (e.g. navigating away mid-reply) instead of being dropped.
- `deleteChat` chunks message deletions into batches under Firestore's
  500-operation limit, so long chats delete cleanly.
- Google Sign-In (spec marked this optional)
- Advanced settings UI for temperature/top_p/max_tokens (currently hardcoded
  per the spec's suggested defaults: temperature 1, top_p 0.95, max_tokens
  4096)
- Rename-chat UI (the service function `renameChat` exists; no screen wires
  it to a text prompt yet)
- Offline persistence config (RNFirebase supports it out of the box; needs a
  one-line enable call if you want it — see RNFirebase docs)
- Retry affordance on stream error beyond the visible error message
"# chatbot_nim" 
