import { Platform } from 'react-native';

/**
 * Light "glass on white" design tokens. Background is white per product
 * direction; the frosted-glass treatment lives only in buttons (GlassButton).
 * Translucent fills/borders are tuned so surfaces stay readable over white.
 */
export const colors = {
  // base background layers (top to bottom in GlassBackground)
  bgBase: '#ffffff',
  bgBaseAlt: '#f4f6fa',
  blob1: '#eef1ff', // pastel lavender (unused by default background)
  blob2: '#e8f7f8', // pastel cyan
  blob3: '#ffeef5', // pastel pink

  // text
  textPrimary: '#0d1220',
  textSecondary: 'rgba(13,18,32,0.62)',
  textMuted: 'rgba(13,18,32,0.38)',

  // accents
  accent: '#0a6cff',
  accentSoft: 'rgba(10,108,255,0.12)',
  danger: '#ff3b5c',

  // surface layers (translucent fills over white)
  glassLight: 'rgba(255,255,255,0.78)',
  glassLighter: 'rgba(244,246,250,0.88)',
  glassDark: 'rgba(248,249,252,0.94)',
  glassBorder: 'rgba(13,18,32,0.14)',
  glassBorderSubtle: 'rgba(13,18,32,0.07)',
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

/**
 * BlurView intensity per platform. Kept for the button glass effect only.
 */
export const blurIntensity = {
  card: Platform.OS === 'ios' ? 22 : 45,
  header: Platform.OS === 'ios' ? 28 : 55,
  blob: Platform.OS === 'ios' ? 60 : 90,
};
