# Aurora — Personal AI Assistant

Cross-platform personal AI assistant (**web · desktop · mobile**) powered by **NVIDIA NIM**, backed by **Neon Postgres**, with voice in/out from Phase 4.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS 4 |
| Backend | Fastify · TypeScript |
| Database | Neon Postgres · Prisma · pgvector |
| AI | NVIDIA NIM (OpenAI-compatible API) |
| Desktop | Tauri (Phase 8) |
| Mobile | Capacitor (Phase 8) |

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

# 3. database (needs NEON_DATABASE_URL in server/.env)
npm run db:generate
npm run db:vector   # enables pgvector on Neon
npm run db:push     # creates tables

# 4. run (two terminals)
npm run dev:server  # API  → http://localhost:8787
npm run dev:web     # UI   → http://localhost:5173
```

The app runs fine **without** keys — the UI shell works offline and the header shows server status.

## Phase checklist

- [x] **Phase 1** — Monorepo · app shell · Neon/Prisma wiring
- [x] **Phase 2** — Auth + database (scrypt passwords, HTTP-only cookie sessions, conversations/messages persisted to Neon, per-user isolation, guest/local mode fallback)
- [x] **Phase 3** — Chat MVP (NVIDIA NIM streaming, markdown, model selector, stop; history now persists via Phase 2)
- [ ] **Phase 4** — Voice (push-to-talk, hands-free, auto-speak, hybrid STT/TTS)
- [ ] **Phase 5** — Memory (NIM embeddings + pgvector recall)
- [ ] **Phase 6** — Web search tool
- [ ] **Phase 7** — Files & tasks
- [ ] **Phase 8** — Desktop (Tauri) + mobile (Capacitor)
- [ ] **Phase 9** — Polish, security, deployment
