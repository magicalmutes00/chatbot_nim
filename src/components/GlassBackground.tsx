import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme/glass';

/**
 * Full-screen white backdrop. The glass treatment is intentionally limited to
 * buttons; screens render on plain white.
 */
export function GlassBackground({ children }: { children?: React.ReactNode }) {
  return <View style={styles.root}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
});
