import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const AUTH_EMAIL_KEY = 'auth_email';
const API_BASE = 'http://localhost:8787/api/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const email = await AsyncStorage.getItem(AUTH_EMAIL_KEY);
        if (mounted) {
          if (email) {
            setUser({ uid: 'mobile-user', email });
          }
          setInitializing(false);
        }
      } catch {
        if (mounted) setInitializing(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      initializing,
      signUp: async (email, password) => {
        const res = await fetch(`${API_BASE}/sign-up/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Sign up failed');
        }
        await AsyncStorage.setItem(AUTH_EMAIL_KEY, email);
        setUser({ uid: 'mobile-user', email });
      },
      signIn: async (email, password) => {
        const res = await fetch(`${API_BASE}/sign-in/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || 'Sign in failed');
        }
        await AsyncStorage.setItem(AUTH_EMAIL_KEY, email);
        setUser({ uid: 'mobile-user', email });
      },
      signInWithGoogle: async () => {
        throw new Error('Google Sign-In has been removed');
      },
      signOut: async () => {
        try {
          await fetch(`${API_BASE}/sign-out`, {
            method: 'POST',
            credentials: 'include',
          });
        } catch {}
        await AsyncStorage.removeItem(AUTH_EMAIL_KEY);
        setUser(null);
      },
      resetPassword: async (email) => {
        throw new Error('Password reset is not supported in Neon Auth flow');
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
