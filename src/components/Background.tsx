import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function Background({ children }: { children?: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.root, { backgroundColor: colors.bgBase }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
