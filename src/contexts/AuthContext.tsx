import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Config from 'react-native-config';

interface AuthUser {
  uid: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  initializing: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const auth = getAuth();

/**
 * OAuth 2.0 "Web application" client ID of the Firebase project. This is a
 * public identifier, not a secret; overriding it through `.env` lets the app
 * point at another Firebase project without a code change.
 */
const GOOGLE_WEB_CLIENT_ID =
  Config.GOOGLE_WEB_CLIENT_ID ||
  '927019487925-n4gaechj7qace8l7kfdfpaoe88743iqh.apps.googleusercontent.com';

// Safe to call at module scope: configure() is synchronous and idempotent.
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false });

/** Human-readable copy for the Firebase / Google Sign-In errors users hit. */
export function authErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message)
      : '';

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return "That email and password don't match.";
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/missing-password':
      return 'Enter your password.';
    case 'auth/email-already-in-use':
      return 'An account already exists for that email.';
    case 'auth/weak-password':
      return 'Use at least 6 characters for your password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error — check your connection and try again.';
    case 'auth/operation-not-allowed':
      return "That sign-in method isn't enabled in Firebase yet.";
    case 'auth/account-exists-with-different-credential':
      return 'That email already uses a different sign-in method.';
    case 'auth/user-disabled':
      return 'That account has been disabled.';
    case 'auth/requires-recent-login':
      return 'Please sign in again to continue.';
    case 'SIGN_IN_CANCELLED':
    case '12501':
      return 'Google sign-in was cancelled.';
    case 'PLAY_SERVICES_NOT_AVAILABLE':
      return 'Google Play Services is unavailable or out of date.';
    case 'NULL_PRESENTER':
      return 'Could not open the Google sign-in window. Try again.';
    default:
      return message || fallback;
  }
}

/** Preserve Firebase's error code so callers can special-case cancellation. */
function toAuthError(error: unknown, fallback?: string): Error {
  const wrapped = new Error(authErrorMessage(error, fallback)) as Error & { code?: string };
  if (typeof error === 'object' && error !== null && 'code' in error) {
    wrapped.code = String((error as { code?: unknown }).code);
  }
  return wrapped;
}

function toAuthUser(firebaseUser: User | null): AuthUser | null {
  if (!firebaseUser) return null;
  return { uid: firebaseUser.uid, email: firebaseUser.email ?? '' };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(toAuthUser(firebaseUser));
      setInitializing(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signUp: async (email, password) => {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (error) {
          throw toAuthError(error, 'Could not create that account.');
        }
      },
      signIn: async (email, password) => {
        try {
          await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
          throw toAuthError(error, 'Could not sign in.');
        }
      },
      signInWithGoogle: async () => {
        try {
          await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
          const response = await GoogleSignin.signIn();
          if (response.type === 'cancelled') return;

          const idToken = response.data?.idToken;
          if (!idToken) {
            throw new Error(
              'Google did not return an ID token. Check the OAuth client configuration.',
            );
          }

          await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
        } catch (error) {
          // Let the caller see cancellation as a code it can ignore.
          throw toAuthError(error, 'Google sign-in failed.');
        }
      },
      signOut: async () => {
        // Clear the cached Google account too, so the next sign-in shows the picker.
        await GoogleSignin.signOut().catch(() => undefined);
        await firebaseSignOut(auth);
      },
      resetPassword: async (email) => {
        try {
          await sendPasswordResetEmail(auth, email);
        } catch (error) {
          throw toAuthError(error, 'Could not send the reset email.');
        }
      },
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
