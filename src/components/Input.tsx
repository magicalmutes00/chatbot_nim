import React, { useMemo } from 'react';
import { StyleSheet, TextInput, TextInputProps, View, Text } from 'react-native';
import { Surface } from './Surface';
import { radius, type ThemeColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

interface InputProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label?: string;
  error?: string | null;
}

export function Input({ label, error, ...rest }: InputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Surface radius={radius.md} tone="muted" border shadow={false}>
        <TextInput
          {...rest}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          selectionColor={colors.accent}
        />
      </Surface>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
