# Aurora Personal AI Assistant - Phase Plan

## Completed
### Phase 1 - Monorepo Scaffold
- React web shell, Fastify backend skeleton
- Prisma schema with pgvector, Neon connection
- Health endpoint

### Phase 2 - Auth Cutover to Neon Auth (superseded by Phase 12)
- Custom scrypt auth removed, migrated to Neon Auth Managed Better Auth
- Custom proxy stripping domain from Set-Cookie
- `requireAuth` validates `neon_auth.session` via SQL
- Web UI wired to `@neondatabase/auth-ui` + `@neondatabase/neon-js`
- Database wiped and migrated cleanly

### Phase 3 - NIM Streaming Chat
- Real NVIDIA NIM streaming via OpenAI-compatible API
- SSE streaming with start/delta/done/error
- Model selector, stop button, markdown rendering
- Conversation/message persistence to Neon

### Phase 4 - Mobile Client Integration
- React Native app from `chatbot_nim` cloned and adapted
- AuthContext now uses Neon Auth backend via fetch + AsyncStorage
- `nimClient` points to backend `/api/chat` SSE endpoint
- Models synced to backend catalog
- Firestore services stubbed to REST polling
- Monorepo copied into `chatbot_nim/personal-ai-assistant/` and pushed

### Phase 5 - Voice I/O
- Web SpeechRecognition wired in Composer, mic toggle, transcript ? draft
- Listening UI and real-time transcription active

### Phase 6 - Desktop Tauri Shell
- `apps/desktop` scaffolded with Tauri 2 + Vite
- tauri.conf.json points to http://localhost:5174 dev and ../dist build
- Native window 1200x800, product name Aurora
- System tray / menu scaffolding in place

### Phase 7 - S3-compatible Storage
- Server env extended with S3_ENDPOINT, S3_BUCKET, keys
- `POST /api/attachments/upload-url` returns signed PUT URL for Neon S3
- Client-side uploader in Composer: file picker, signed upload, attachment preview with remove
- `POST /api/chat` accepts attachments array, persists Attachment records linked to user message
- Routes registered in server index

### Phase 8 - Voice I/O Completion & Desktop Polish
- SpeechSynthesis reply playback with toggle in header
- Desktop Tauri system tray with Show/Quit menu, tauri-plugin-store for cookie persistence
- Cookie sharing via CORS credentials, webview session persistence
- Neon Auth session cookie names fixed: `__Secure-neon-auth.session_token` is now validated by `requireAuth` (legacy Better Auth names kept as fallbacks)
- Verified live flow: sign-up/sign-in through the Vite -> Fastify auth proxy returns 200, session cookie is accepted, `/api/conversations` returns 200, and streaming `/api/chat` returns `start` -> `delta` -> `done`

### Phase 9 - Desktop Launch & Production Hardening
- Rust toolchain (1.99.1) and Visual Studio 2022 Build Tools (MSVC 14.44 + Windows SDK 10.0.26100) installed
- Desktop: global hotkey `Ctrl+Shift+Space` toggles/focuses the window; closing hides to tray; tray Show/Quit
- Desktop dev reuses the web dev server via an idempotent `scripts/ensure-web.mjs` pre-step
- Packaged desktop builds the web app in `desktop` mode against an absolute API/auth base (`apps/web/.env.desktop`)
- Server hardening: global + per-user rate limits, 2 MB body cap, security headers, JSON 404/error handlers, graceful shutdown, richer `/api/health`
- Composer: multi-file attachment upload (no stale-state overwrite), upload progress, per-file errors, size chips
- Image recognition: vision models (`nvidia/nemotron-3.5-super-vl-120b-a12b`, `minimaxai/minimax-m3.1-flash`) added; chat presigns S3 image URLs and sends OpenAI-style `image_url` parts
- Attaching an image auto-switches to a vision model; non-vision requests with images return a clear 400
- Verified end-to-end with a real upload: signed PUT → vision reply streamed `start` → `delta` → `done`
- GLM chat models added (`z-ai/glm-5.3`, `z-ai/glm-5.3-flash`); note: NIM currently queues them for ~2–5 minutes before the first token
- Image generation: `POST /api/images/generate` calls NVIDIA NIM `genai` (FLUX.1 Dev), stores the render in S3, persists it as an assistant attachment, and returns a presigned URL; history re-presigns stored images
- Model picker groups chat and image models; image mode swaps the composer to an aspect-ratio picker, hides file attachments, and renders results inline
- FLUX policy refusals (`finishReason: CONTENT_FILTERED`) return a friendly 422 instead of storing a black frame
- GLM latency measured end-to-end through the app: first delta at ~125 s, done at ~125 s (upstream queue). Composer now shows an amber slow-start notice when a GLM model is selected, and the catalog descriptions warn about the queue
- Header is now responsive: model name truncates, tags/status collapse on narrow widths, dropdown is viewport-capped and closes on Escape
- Desktop verified running: window title Aurora, tray Show/Quit, close-to-tray, no hotkey registration error

### Phase 10 - Long-Term Memory (pgvector Recall)
- `Memory` rows store one durable fact each, embedded with NVIDIA NIM `nvidia/nemotron-3.5-embed-1b` (2048 dims, asymmetric `query`/`passage` inputs)
- `Memory.embedding` is `halfvec(2048)`: pgvector's HNSW index caps `vector` at 2000 dims, so `vector` cannot be indexed at this width. Prisma can't diff `Unsupported(...)`, so the resize and index live in `prisma/sql/memory-vectors.sql` (`npm run db:memory`)
- Recall runs before the stream starts: top-5 cosine matches at `>= 0.18` are folded into the system prompt, and the `start` SSE event reports how many were used
- After each completed turn, a fast model extracts new durable facts (few-shot JSON prompt, secrets excluded); extraction is fire-and-forget and can never fail the reply
- Dedupe: the extractor is shown the user's existing facts, plus an exact-text check and a 0.97 cosine guard. Short facts embed too closely for a lower cutoff ("lives in Bengaluru" vs "works in Bengaluru" = 0.93)
- API: `GET/POST /api/memories`, `PATCH /api/memories/settings`, `DELETE /api/memories/:id` (all auth-scoped, 30 writes/min)
- UI: slide-over Memory panel from the sidebar with an auto-learn switch, manual add form, Added/Learned badges, per-fact delete, and loading/empty/error states
- Assistant replies show a "Used N memories" chip when recall contributed context
- Verified end-to-end: facts stated in one conversation were extracted, recalled in a fresh conversation, and steered the reply ("avoid peanuts"); test user removed afterwards
- Calibration notes: only the `nemotron-embed` family answered on this account (`arctic-embed-l`, `nv-embedqa-*`, `llama-3.2-nv-embedqa-1b-v1` return 404); recall thresholds tuned to 0.18 so unrelated facts stay out

### Phase 11 - Tasks & Reminders
- `Task` model with title/description/status/due date, per-user scoping, and four statuses (TODO, IN_PROGRESS, DONE, CANCELLED)
- API: `GET /api/tasks`, `GET /api/tasks/count`, `POST /api/tasks`, `PATCH/DELETE /api/tasks/:id` - auth-scoped, validated, 60 writes/min per user
- Date-only due dates are stored at noon UTC so the calendar day survives timezones; the client sends its IANA `timezone` with each chat turn so "tomorrow" resolves locally
- Up to 8 open tasks (soonest first) are folded into the chat system prompt with instructions not to recite them, so "what's on my list?" answers without a tool call
- Extraction is gated by `looksLikeTaskRequest` (reminder/task/deadline phrasing only), runs concurrently with the reply, and streams a `tasks` SSE event after `done`; `start` now reports the open-task count
- UI: Tasks slide-over (add with optional date, complete/reopen, delete, overdue badges, Completed section), sidebar entry with an open-count badge, and inline task chips on the reply
- Verified end-to-end: REST validation and cross-user isolation, extraction cases (reminder and deadline create tasks; vague intention and question do not), task recall in a fresh conversation, panel add/toggle/delete; test users removed afterwards
- Fixed the model picker too: the header's `backdrop-blur` made it the containing block for the `fixed` click-catcher and, without a z-index, left the menu under page content. The header is now `relative z-20` and outside presses close the menu through a document listener instead of an overlay button

### Phase 12 - Firebase Auth Migration
- Replaced Neon Auth with Firebase Authentication on web/desktop: `firebase/app` + `firebase/auth` initialized from `VITE_FIREBASE_*` (public web identifiers), session state from `onAuthStateChanged`
- Custom `AuthGate`: email/password sign-in, account creation, password reset, and a Google button (`signInWithPopup` + `GoogleAuthProvider`); Firebase error codes mapped to human copy
- Server verifies Firebase ID tokens with `jose` against Google's public JWKS (issuer/audience pinned to `FIREBASE_PROJECT_ID`), so no service-account key is stored
- Clients send `Authorization: Bearer <idToken>`; `apiFetch` refreshes the token via the SDK before each request. Cookies, the Neon Auth proxy, `@fastify/cookie`, and the Neon auth packages were removed
- Accounts are upserted by email, so Neon-era users keep their conversations, memories, and tasks when they sign in with the same address; new users use the Firebase UID as `User.id`
- `/api/health` reports `auth.mode: "firebase"`
- Verified end-to-end: REST sign-up returned an ID token, protected routes accepted it, unauthenticated calls got 401, the mirrored `public.users` row used the Firebase UID, the UI sign-in landed in the app, a streamed chat turn returned `start` → `delta` → `done`, and the Google button opened Google's OAuth consent for the project; test account removed afterwards
- Google sign-in strategy: the popup flow everywhere (`signInWithPopup` hands the credential back over `postMessage`, which WebView2 supports); the Tauri window is now built in Rust with `on_new_window(NewWindowResponse::Allow)` because a config-declared window installs no `NewWindowRequested` handler and WebView2 silently cancels `window.open`; browsers that still block the popup fall back to `signInWithRedirect` + `getRedirectResult`, which warns instead of failing silently when the result is lost
- Mobile (`chatbot_nim`) cutover: `AuthContext` now uses React Native Firebase (`onAuthStateChanged`, email/password, reset mail) with Google Sign-In through `@react-native-google-signin` → `signInWithCredential`; the old AsyncStorage/Neon proxy path and the fabricated `mobile-user` id are gone
- Mobile API calls now send `Authorization: Bearer <idToken>`: a shared `src/api/backend.ts` serves REST (`backendFetch`) and the chat SSE `XMLHttpRequest`; `credentials: 'include'` was removed
- Mobile chat adopts the server's `start.conversationId`, so follow-up turns append to the same conversation instead of creating one per message, and history/images load through the authenticated conversation endpoints
- Mobile config: `.env` carries the Firebase OAuth Web client ID (Android), the iOS `REVERSED_CLIENT_ID` URL scheme is declared in `Info.plist`, Android debug builds allow cleartext HTTP to the dev API, and `BACKEND_URL` may override the emulator/LAN host

### Phase 13 - Mobile Image Generation
- Mobile model catalog gained `black-forest-labs/flux.1-dev` (`kind: 'image'`); the ratio chips now use the backend's supported sizes only (1:1, 16:9, 9:16) instead of the retired 4:3/3:4 presets the image route silently coerced to square
- `src/api/nimImageClient.ts` posts to `/api/images/generate` through `backendFetch` (Bearer token, NIM key stays server-side), forwards the selected size, and adopts the returned `conversationId` so the first image in a new chat creates the conversation
- Generated renders are stored in S3 and appended to the conversation server-side, so the existing history poll renders them again after a restart; a session-scoped aspect cache keyed by S3 object keeps landscape/portrait art from being cropped to a square when the presigned URL is re-read
- The client no longer tries to persist images into Firestore (the 700 KB data-URI guard is gone); aborts still cancel the render through the request signal
- `README.md` documents the image flow; verified with `tsc`, `eslint`, and `jest` (no Android toolchain on this machine)

### Phase 14 - Mobile Attachments & Vision
- Mobile model catalog gained the two vision models the server exposes (`nvidia/nemotron-3.5-super-vl-120b-a12b`, `minimaxai/minimax-m3.1-flash`) with a `vision` flag and a `VIS` badge in the model picker
- The composer's **+** button opens `react-native-image-picker` (one photo, 1600 px cap, quality 0.8, `assetRepresentationMode: 'compatible'` so HEIC becomes JPEG), uploads on selection, and shows a removable thumbnail with size + target model
- Upload path mirrors web: `POST /api/attachments/upload-url` -> presigned S3 PUT (base64 written to cache, uploaded with `react-native-blob-util`, temp file removed) -> key sent as `attachments[]` on `/api/chat`; the server presigns GETs for the vision model and persists the attachment on the user message
- Sending a photo auto-switches to a vision model and re-checks at send time, so a manually chosen text model cannot produce the server's 400; text-only models still hide the attach button and image models clear a pending photo
- The optimistic user bubble shows the local preview immediately; the polled copy replaces it by role+content and renders the stored presigned image at the remembered aspect ratio
- Generated and uploaded images share one aspect cache (`src/services/imageAspects.ts`), keyed by S3 key, so landscape art is not cropped to a square after a history refresh
- `firestoreChats` maps user-message attachments too, so attached photos survive app restarts; `nimClient` forwards `attachments` in the streaming request body
- iOS `Info.plist` gained `NSPhotoLibraryUsageDescription`; `README.md` notes the native rebuild/`pod install` requirement
- Verified with `tsc`, `eslint`, and `jest` (3 suites / 7 tests incl. upload presign, S3 PUT failure cleanup, and image request shape); no Android SDK/emulator on this machine, so no on-device click-through yet

## Remaining
- Mobile (React Native `chatbot_nim`): voice, memories, and tasks parity - no Android SDK/toolchain is installed on this machine
- Mobile chat can now be built with the Firebase setup in `chatbot_nim/.env.example`; iOS Google Sign-In still needs `pod install` on a Mac (the URL scheme is already declared), and a real device needs `BACKEND_URL` pointed at the LAN address

