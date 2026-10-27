# Aurora — Personal AI Assistant

Cross-platform personal AI assistant (**web · desktop · mobile**) powered by **NVIDIA NIM**, backed by **Neon Postgres**, with Firebase Auth, voice in/out, image understanding and generation, pgvector long-term memory, and chat-driven tasks & reminders.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS 4 |
| Backend | Fastify · TypeScript |
| Database | Neon Postgres · Prisma · pgvector |
| Auth | Firebase Authentication (email/password + Google) |
| AI | NVIDIA NIM (OpenAI-compatible API) |
| Desktop | Tauri 2 |
| Mobile | React Native (`chatbot_nim`) |

## Project layout

```
personal-ai-assistant/
├─ apps/web/     # React app (shared UI for all platforms)
├─ server/       # Fastify API + Prisma schema
├─ packages/     # shared code (added in later phases)
└─ .env.example
```

## Quickstart

```bash
# 1. install
npm install

# 2. configure — copy .env.example to server/.env and fill in your keys
Copy-Item .env.example server/.env   # (Windows)
# cp .env.example server/.env        # (macOS/Linux)

# 2b. Firebase — add the web app config to apps/web/.env
#     VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID,
#     VITE_FIREBASE_STORAGE_BUCKET, VITE_FIREBASE_MESSAGING_SENDER_ID,
#     VITE_FIREBASE_APP_ID, VITE_FIREBASE_MEASUREMENT_ID
#     In the Firebase console enable Email/Password and Google under
#     Authentication → Sign-in method, and add localhost (plus tauri.localhost
#     for desktop) under Authentication → Settings → Authorized domains.
#     The server only needs FIREBASE_PROJECT_ID — no service-account key.

# 3. database (needs NEON_DATABASE_URL in server/.env)
npm run db:generate
npm run db:vector   # enables pgvector on Neon
npm run db:push     # creates tables
npm run db:memory   # halfvec(2048) memory column + HNSW index

# 4. run (two terminals)
npm run dev:server  # API  → http://localhost:8787
npm run dev:web     # UI   → http://localhost:5175
```

The app runs fine **without** keys — the UI shell works offline and the header shows server status.

## Mobile (`chatbot_nim`)

The React Native client uses the same Firebase project and the same Bearer-token
API:

```bash
cd chatbot_nim
npm install

# Google Sign-In needs the OAuth *Web* client ID (public identifier).
Copy-Item .env.example .env
# GOOGLE_WEB_CLIENT_ID=927019487925-...apps.googleusercontent.com

npm run android   # or: npm run ios
```

- `android/app/google-services.json` and `ios/NimChatApp/GoogleService-Info.plist`
  must belong to the same Firebase project as the web app.
- Google Sign-In on Android uses `GOOGLE_WEB_CLIENT_ID`; iOS uses the
  `REVERSED_CLIENT_ID` URL scheme already declared in `Info.plist`.
- `BACKEND_URL` is optional. Defaults are `http://10.0.2.2:8787` on the Android
  emulator and `http://localhost:8787` elsewhere; set it to your LAN address for
  a physical device.
- Enable Email/Password and Google under Firebase → Authentication → Sign-in
  method. Android debug builds allow cleartext HTTP so they can reach the local
  server; switch `usesCleartextTraffic` to `false` once `BACKEND_URL` is HTTPS.

## Phase checklist

- [x] **Phase 1** — Monorepo · app shell · Neon/Prisma wiring
- [x] **Phase 2** — Neon Auth cutover (superseded by Firebase in Phase 12; accounts matched by email)
- [x] **Phase 3** — Chat MVP (NVIDIA NIM streaming, markdown, model selector, stop, persisted history)
- [x] **Phase 4** — Mobile client integration (`chatbot_nim` → Aurora backend)
- [x] **Phase 5** — Web voice input (speech recognition → composer)
- [x] **Phase 6** — Desktop Tauri shell
- [x] **Phase 7** — S3-compatible attachment storage
- [x] **Phase 8** — Voice playback, tray, cookie persistence, auth fix
- [x] **Phase 9** — Desktop launch, image understanding/generation, GLM models, production hardening
- [x] **Phase 10** - Long-term memory (NIM embeddings + pgvector recall, auto-learn, Memory panel)
- [x] **Phase 11** - Tasks & reminders (chat extraction, task context, Tasks panel, sidebar badge)
- [x] **Phase 12** - Firebase Auth (email/password + Google, Bearer ID tokens, email-matched accounts; web · desktop · mobile)
- [ ] **Next** — Mobile attachment/vision/generation parity (needs an Android toolchain)
