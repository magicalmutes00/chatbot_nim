import { getAuth } from '@react-native-firebase/auth';
import Config from 'react-native-config';
import { Platform } from 'react-native';

/**
 * Base URL of the Aurora backend (Fastify + Neon Postgres + NIM).
 *
 * The NIM key lives only on the server, so every AI call goes through here.
 * Override `BACKEND_URL` in `.env` for a physical device or a deployed API;
 * the Android emulator reaches the host at 10.0.2.2.
 */
export const BACKEND_URL =
  Config.BACKEND_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8787' : 'http://localhost:8787');

/**
 * Firebase ID token for the signed-in user, refreshed by the SDK when it is
 * close to expiring. Returns null when signed out so callers can still hit
 * public routes (health) without an Authorization header.
 */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  const current = getAuth().currentUser;
  if (!current) return null;
  try {
    return await current.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

/** Header bag for XMLHttpRequest, which cannot await a token itself. */
export async function authHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

/** `fetch` wrapper that attaches the current Firebase ID token. */
export async function backendFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  return fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...((init.headers as Record<string, string> | undefined) ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

/**
 * Reads the server's `{ error }` / `{ message }` payload from a failed
 * response, falling back to a caller-supplied status message.
 */
export async function backendErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: unknown; message?: unknown };
    const message = typeof data.error === 'string' ? data.error : data.message;
    if (typeof message === 'string' && message.trim().length > 0) return message;
  } catch {
    // Not JSON (proxy error page, truncated body): use the fallback.
  }
  return fallback;
}
