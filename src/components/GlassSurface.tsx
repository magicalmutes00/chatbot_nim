import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { blurIntensity, colors, radius } from '../theme/glass';

interface GlassSurfaceProps extends ViewProps {
  radius?: number;
  intensity?: number;
  /** Lighter overlay (for cards over dark bg); darker (for chat bubbles / sticky bars). */
  tone?: 'light' | 'lighter' | 'dark';
  border?: boolean;
  shadow?: boolean;
  children?: React.ReactNode;
}

/**
 * The atom of the glass design. A BlurView with a translucent overlay, optional
 * hairline border, and optional shadow. Everything else in the UI composes from this.
 */
export function GlassSurface({
  radius: r = radius.lg,
  intensity = blurIntensity.card,
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
          overflow: 'hidden',
          borderWidth: border ? StyleSheet.hairlineWidth : 0,
          borderColor,
        },
        shadow && {
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
        style,
      ]}
      {...rest}
    >
      <BlurView
        blurType="dark"
        blurAmount={intensity}
        reducedTransparencyFallbackColor={colors.bgBase}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay, borderRadius: r }]} />
      <View style={{ borderRadius: r }}>{children}</View>
    </View>
  );
}
