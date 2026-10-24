import { createAuthClient } from "@neondatabase/neon-js/auth";
import { BetterAuthReactAdapter } from "@neondatabase/neon-js/auth/react/adapters";

/**
 * Neon Auth (Managed Better Auth).
 * Auth API calls go through the same-origin proxy (/api/auth → Neon),
 * so session cookies stay first-party.
 */
export const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL ?? "/api/auth", {
  adapter: BetterAuthReactAdapter(),
});

export const { useSession } = authClient;
