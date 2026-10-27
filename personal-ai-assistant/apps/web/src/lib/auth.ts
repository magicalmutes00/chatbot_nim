import { useEffect, useState } from "react";
import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "./firebase";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
}

type Session = { user: SessionUser } | null;

function toSessionUser(user: User): SessionUser {
  return {
    id: user.uid,
    email: user.email ?? "",
    name: user.displayName,
  };
}

/**
 * Firebase Auth session state.
 *
 * Mirrors the shape the Neon Auth client used to expose (`data` / `isPending`)
 * so the rest of the app only had to change where it signs out.
 */
export function useSession(): { data: Session; isPending: boolean } {
  const [session, setSession] = useState<Session>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    if (!firebaseAuth) {
      setIsPending(false);
      return;
    }
    return onAuthStateChanged(firebaseAuth, (user) => {
      setSession(user ? { user: toSessionUser(user) } : null);
      setIsPending(false);
    });
  }, []);

  return { data: session, isPending };
}

/** Current ID token, refreshed by the SDK when it is close to expiring. */
export async function getIdToken(): Promise<string | null> {
  const user = firebaseAuth?.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function signOutUser(): Promise<void> {
  if (!firebaseAuth) return;
  await signOut(firebaseAuth);
}

/**
 * True when the page runs inside the Tauri desktop shell.
 *
 * Kept for callers that need to branch on the host; the desktop window is
 * built with popups allowed (see `src-tauri/src/main.rs`), so auth itself no
 * longer needs it.
 */
export function isDesktopShell(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  return Boolean(w.__TAURI_INTERNALS__ ?? w.__TAURI__);
}

function errorCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

/** Popups that can be retried as a redirect instead of failing outright. */
function canFallBackToRedirect(error: unknown): boolean {
  const code = errorCode(error);
  return (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment"
  );
}

/** Remembers that we left the page for a redirect, so a lost result is visible. */
const REDIRECT_FLAG = "aurora.googleRedirect";

/**
 * Starts Google sign-in.
 *
 * The popup flow is used everywhere — it hands the credential back over
 * `postMessage`, which works in WebView2, whereas the redirect flow cannot read
 * its result inside the desktop webview. A browser that blocks the popup still
 * falls back to a redirect, completed by `completeGoogleRedirect`.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!firebaseAuth) throw new Error("Firebase is not configured.");

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    await signInWithPopup(firebaseAuth, provider);
  } catch (error) {
    if (!canFallBackToRedirect(error)) throw error;
    try {
      sessionStorage.setItem(REDIRECT_FLAG, "1");
    } catch {
      // Private mode / storage disabled: the redirect still works, we just
      // cannot detect a lost result afterwards.
    }
    await signInWithRedirect(firebaseAuth, provider);
  }
}

/**
 * Resolves a Google redirect (or no-ops when the page was not a redirect
 * return). Returns a message when we left for a redirect but came back without
 * a credential — the desktop webview cannot read the cross-origin result.
 */
export async function completeGoogleRedirect(): Promise<string | null> {
  if (!firebaseAuth) return null;

  let expected = false;
  try {
    expected = sessionStorage.getItem(REDIRECT_FLAG) === "1";
  } catch {
    // ignore
  }

  const result = await getRedirectResult(firebaseAuth);

  if (expected) {
    try {
      sessionStorage.removeItem(REDIRECT_FLAG);
    } catch {
      // ignore
    }
  }

  if (result) return null;
  if (expected) {
    return "Google sign-in came back without a credential in this window. Try again — or sign in with email.";
  }
  return null;
}

/** Human-readable copy for the error codes the auth forms actually hit. */
export function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";

  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/email-already-in-use":
      return "An account already exists for that email.";
    case "auth/weak-password":
      return "Use at least 6 characters for your password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Google sign-in needs a pop-up here. Allow pop-ups for this site and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized in Firebase. Add it under Authentication → Settings → Authorized domains (tauri.localhost for the desktop build).";
    case "auth/operation-not-allowed":
      return "That sign-in method isn't enabled in Firebase yet.";
    case "auth/account-exists-with-different-credential":
      return "That email already uses a different sign-in method.";
    default:
      return error instanceof Error && error.message
        ? error.message
        : "Something went wrong. Try again.";
  }
}

export { isFirebaseConfigured };
