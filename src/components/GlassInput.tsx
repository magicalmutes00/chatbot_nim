import React from 'react';
import { StyleSheet, TextInput, TextInputProps, View, Text } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { colors, radius } from '../theme/glass';

interface GlassInputProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label?: string;
  error?: string | null;
}

export function GlassInput({ label, error, ...rest }: GlassInputProps) {
  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <GlassSurface radius={radius.md} tone="lighter" border shadow={false}>
        <TextInput
          {...rest}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          selectionColor={colors.accent}
        />
      </GlassSurface>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
    marginLeft: 4,
  },
  input: {
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  error: { color: colors.danger, fontSize: 12, marginTop: 6, marginLeft: 4 },
});
