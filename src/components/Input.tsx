import React, { useMemo, useState } from 'react';
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
  const [focused, setFocused] = useState(false);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const focusStyle = useMemo(
    () => ({ borderColor: colors.accent, borderWidth: 1 }),
    [colors],
  );

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Surface
        radius={radius.md}
        tone="muted"
        border
        shadow={false}
        style={focused ? focusStyle : null}
      >
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
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
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 7,
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
