import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut as firebaseSignOut,
  type User,
} from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Config from 'react-native-config';

// webClientId = OAuth "Web application" client from the same Firebase project
// (Firebase console → Authentication → Google provider). Provided via .env.
GoogleSignin.configure({
  webClientId: Config.GOOGLE_WEB_CLIENT_ID ?? '',
  offlineAccess: false,
});

interface AuthContextValue {
  user: User | null;
  initializing: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // RNFirebase persists the session (AsyncStorage-backed) by default,
    // so this fires with the restored user on cold start.
    const unsubscribe = onAuthStateChanged(getAuth(), (firebaseUser) => {
      setUser(firebaseUser);
      if (initializing) setInitializing(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signUp: async (email, password) => {
        await createUserWithEmailAndPassword(getAuth(), email, password);
      },
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(getAuth(), email, password);
      },
      signInWithGoogle: async () => {
        if (!Config.GOOGLE_WEB_CLIENT_ID) {
          throw new Error(
            'Google Sign-In is not configured. Add GOOGLE_WEB_CLIENT_ID to .env (Web application OAuth client of this Firebase project) and rebuild.',
          );
        }
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const result = await GoogleSignin.signIn();
        if (result.type === 'cancelled') return;
        const idToken = result.data?.idToken;
        if (!idToken) {
          throw new Error('Google Sign-In returned no idToken. Check GOOGLE_WEB_CLIENT_ID in .env.');
        }
        await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
      },
      signOut: async () => {
        try {
          await GoogleSignin.signOut();
        } catch {
          // Not signed in via Google — ignore.
        }
        await firebaseSignOut(getAuth());
      },
      resetPassword: async (email) => {
        await sendPasswordResetEmail(getAuth(), email);
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
