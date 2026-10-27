/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute API origin for packaged desktop builds, e.g. http://localhost:8787 */
  readonly VITE_API_BASE?: string;
  /** Firebase web app config (public identifiers, not secrets). */
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
