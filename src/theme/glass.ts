import { Platform } from 'react-native';

/**
 * Glass UI design tokens. Keep all magic numbers here so screens stay readable.
 * Background is intentionally dark — that's what makes the translucent surfaces
 * read as "glass" instead of "white card".
 */
export const colors = {
  // base background layers (top to bottom in GlassBackground)
  bgBase: '#0a0e27',
  bgBaseAlt: '#070a1d',
  blob1: '#6e3aff', // purple
  blob2: '#3acfd5', // cyan
  blob3: '#ff5ea8', // pink

  // text
  textPrimary: '#ffffff',
  textSecondary: 'rgba(255,255,255,0.65)',
  textMuted: 'rgba(255,255,255,0.40)',

  // accents
  accent: '#5ce4ff',
  accentSoft: 'rgba(92,228,255,0.18)',
  danger: '#ff5470',

  // glass surface layers (translucent overlay on top of BlurView)
  glassLight: 'rgba(255,255,255,0.10)',
  glassLighter: 'rgba(255,255,255,0.06)',
  glassDark: 'rgba(8,12,40,0.45)',
  glassBorder: 'rgba(255,255,255,0.18)',
  glassBorderSubtle: 'rgba(255,255,255,0.10)',
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
 * BlurView intensity that looks good on each platform.
 * iOS native blur is strong — lower numbers. Android RenderEffect blur is weaker
 * — push higher. Tints are still required for readability over colorful blobs.
 */
export const blurIntensity = {
  card: Platform.OS === 'ios' ? 22 : 45,
  header: Platform.OS === 'ios' ? 28 : 55,
  blob: Platform.OS === 'ios' ? 60 : 90,
};
