import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius } from '../theme/glass';

interface GlassSurfaceProps extends ViewProps {
  radius?: number;
  /** Kept for API compatibility; selects the surface fill. */
  intensity?: number;
  /** 'light' = white card, 'lighter' = soft gray input well, 'dark' = sticky bar. */
  tone?: 'light' | 'lighter' | 'dark';
  border?: boolean;
  shadow?: boolean;
  children?: React.ReactNode;
}

/**
 * A plain light card surface. Blur was removed from surfaces on purpose —
 * the frosted-glass effect is reserved for buttons (see GlassButton).
 */
export function GlassSurface({
  radius: r = radius.lg,
  tone = 'light',
  border = true,
  shadow = true,
  style,
  children,
  ...rest
}: GlassSurfaceProps) {
  const overlay =
    tone === 'dark' ? colors.glassDark : tone === 'lighter' ? colors.glassLighter : colors.glassLight;
  const borderColor = border ? colors.glassBorder : 'transparent';

  return (
    <View
      style={[
        {
          borderRadius: r,
          backgroundColor: overlay,
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          borderColor,
        },
        shadow && {
          shadowColor: '#0d1220',
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 2,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
