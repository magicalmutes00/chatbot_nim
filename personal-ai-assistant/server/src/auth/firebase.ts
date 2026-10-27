import { createRemoteJWKSet, jwtVerify } from "jose";
import { env, isFirebaseAuthConfigured } from "../config/env.js";

/**
 * Firebase ID token verification.
 *
 * Tokens are Google-signed JWTs. Verifying against Google's public JWKS means
 * the server needs no service-account key — only the project id (public).
 */

const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const jwks = createRemoteJWKSet(new URL(JWKS_URL));

/** What we need from a verified token. */
export interface FirebaseIdentity {
  uid: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
}

interface FirebaseClaims {
  user_id?: unknown;
  email?: unknown;
  name?: unknown;
  email_verified?: unknown;
}

/**
 * Returns the identity for a valid, unexpired ID token, or null when the token
 * is invalid, expired, or belongs to another project. Never throws.
 */
export async function verifyFirebaseIdToken(token: string): Promise<FirebaseIdentity | null> {
  if (!isFirebaseAuthConfigured || token.length === 0) return null;

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://securetoken.google.com/${env.firebaseProjectId}`,
      audience: env.firebaseProjectId,
    });

    const claims = payload as FirebaseClaims;
    const uid = typeof claims.user_id === "string" ? claims.user_id : payload.sub;
    const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
    if (!uid || email.length === 0) return null;

    return {
      uid,
      email,
      name: typeof claims.name === "string" && claims.name.trim().length > 0 ? claims.name.trim() : null,
      emailVerified: claims.email_verified === true,
    };
  } catch {
    return null;
  }
}
