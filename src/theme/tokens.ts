/**
 * Design tokens — dark navy + light palettes with electric blue / lime duotone accents.
 * `colors` values used anywhere must come from the active theme via useTheme(),
 * never from a static import, so the toggle applies everywhere instantly.
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // Base
  bgBase: string;
  bgBaseAlt: string;

  // Solid surfaces
  surface: string; // cards, bubbles, selected rows
  surfaceMuted: string; // input wells, secondary fills
  surfaceBar: string; // sticky bars (chat input bar)

  border: string;
  borderSubtle: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Electric blue — interactive fills (primary buttons, FAB, send, selection)
  accent: string;
  accentSoft: string;
  accentGlow: string;

  // Lime in dark, readable olive-lime in light — highlights & accent text
  accent2: string;
  accent2Soft: string;

  danger: string;
}

export const themes: Record<ThemeMode, ThemeColors> = {
  dark: {
    bgBase: '#0a1128',
    bgBaseAlt: '#070d1d',

    surface: '#1b2547',
    surfaceMuted: '#111936',
    surfaceBar: '#081020',

    border: 'rgba(158, 180, 255, 0.24)',
    borderSubtle: 'rgba(158, 180, 255, 0.12)',

    textPrimary: '#ffffff',
    textSecondary: 'rgba(235, 240, 255, 0.72)',
    textMuted: 'rgba(235, 240, 255, 0.42)',

    accent: '#2457ff',
    accentSoft: 'rgba(36, 87, 255, 0.18)',
    accentGlow: 'rgba(36, 87, 255, 0.40)',

    accent2: '#c8ff3f',
    accent2Soft: 'rgba(200, 255, 63, 0.12)',

    danger: '#ff5c6a',
  },
  light: {
    bgBase: '#f2f5fc',
    bgBaseAlt: '#e8edf7',

    surface: '#ffffff',
    surfaceMuted: '#eaeef7',
    surfaceBar: '#ffffff',

    border: 'rgba(18, 32, 74, 0.14)',
    borderSubtle: 'rgba(18, 32, 74, 0.08)',

    textPrimary: '#0d1530',
    textSecondary: 'rgba(13, 21, 48, 0.68)',
    textMuted: 'rgba(13, 21, 48, 0.45)',

    accent: '#2457ff',
    accentSoft: 'rgba(36, 87, 255, 0.12)',
    accentGlow: 'rgba(36, 87, 255, 0.30)',

    accent2: '#4d7c0f',
    accent2Soft: 'rgba(77, 124, 15, 0.12)',

    danger: '#e0344a',
  },
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 24,
  pill: 999,
};

export const spacing = {
  xs: 3,
  sm: 7,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
};
