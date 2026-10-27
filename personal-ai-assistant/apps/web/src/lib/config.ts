/**
 * API base URL.
 *
 * Web (dev + prod) talks to the same origin, where Vite/nginx proxies `/api`.
 * The packaged desktop app is served from `tauri.localhost`, so it must point
 * at the Aurora server explicitly via `VITE_API_BASE` (see .env.desktop).
 */
const raw = import.meta.env.VITE_API_BASE ?? "";

export const API_BASE = raw.replace(/\/+$/, "");

export const apiUrl = (path: string): string => `${API_BASE}${path}`;
