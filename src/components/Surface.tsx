import React, { useMemo } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

interface SurfaceProps extends ViewProps {
  radius?: number;
  /** 'default' = card fill, 'muted' = input well, 'bar' = sticky bar. */
  tone?: 'default' | 'muted' | 'bar';
  border?: boolean;
  shadow?: boolean;
  children?: React.ReactNode;
}

export function Surface({
  radius: r = radius.lg,
  tone = 'default',
  border = true,
  shadow = true,
  style,
  children,
  ...rest
}: SurfaceProps) {
  const { colors } = useTheme();
  const fill =
    tone === 'bar' ? colors.surfaceBar : tone === 'muted' ? colors.surfaceMuted : colors.surface;
  const borderColorStyle = useMemo(() => ({ borderColor: colors.border }), [colors.border]);

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: fill, borderRadius: r },
        border ? styles.hairline : styles.noBorder,
        borderColorStyle,
        shadow && styles.shadow,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  hairline: { borderWidth: StyleSheet.hairlineWidth },
  noBorder: { borderWidth: 0 },
  shadow: {
    shadowColor: '#050b1c',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});
