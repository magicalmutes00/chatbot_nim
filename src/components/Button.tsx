import React from 'react';
import { StyleSheet, Text, View, Pressable, ViewStyle } from 'react-native';
import { radius } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const [pressed, setPressed] = React.useState(false);

  const fill =
    variant === 'primary'
      ? pressed
        ? '#1e46d9'
        : colors.accent
      : variant === 'destructive'
        ? 'rgba(255,92,106,0.16)'
        : variant === 'ghost'
          ? 'transparent'
          : pressed
            ? colors.surfaceMuted
            : colors.surface;

  const tint = variant === 'destructive' ? colors.danger : colors.textPrimary;

  const borderColor =
    variant === 'ghost'
      ? colors.borderSubtle
      : variant === 'destructive'
        ? colors.danger
        : variant === 'primary'
          ? colors.accentGlow
          : colors.border;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      disabled={disabled || loading}
      style={({ pressed: p }) => [
        { opacity: disabled ? 0.45 : p && variant === 'ghost' ? 0.7 : 1 },
        style,
      ]}
    >
      <View
        style={[
          styles.pill,
          variant !== 'ghost' && styles.pillShadow,
          { backgroundColor: fill, borderColor },
        ]}
      >
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {loading ? '…' : title}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  pillShadow: {
    shadowColor: '#050b1c',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
});
