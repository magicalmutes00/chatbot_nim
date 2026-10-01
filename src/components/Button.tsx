import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, Pressable, View, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
  const scale = useRef(new Animated.Value(1)).current;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, speed: 40, bounciness: 6, useNativeDriver: true }).start();

  const tint = variant === 'destructive' ? colors.danger : colors.textPrimary;
  const fill =
    variant === 'destructive'
      ? 'rgba(255,92,106,0.14)'
      : variant === 'ghost'
        ? 'transparent'
        : pressed
          ? colors.surfaceMuted
          : colors.surface;
  const borderColor =
    variant === 'ghost'
      ? colors.borderSubtle
      : variant === 'destructive'
        ? colors.danger
        : colors.border;

  const inner =
    variant === 'primary' ? (
      <LinearGradient
        colors={colors.gradientPrimary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pill, styles.pillShadow, { shadowColor: colors.accent }]}
      >
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {loading ? '…' : title}
        </Text>
      </LinearGradient>
    ) : (
      <View style={[styles.pill, variant !== 'ghost' && styles.pillShadow, altFill(fill, borderColor)]}>
        <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
          {loading ? '…' : title}
        </Text>
      </View>
    );

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          setPressed(true);
          animate(0.97);
        }}
        onPressOut={() => {
          setPressed(false);
          animate(1);
        }}
        disabled={disabled || loading}
        style={({ pressed: p }) => [
          p && variant === 'ghost' ? styles.ghostPressed : null,
          disabled && !loading ? styles.disabled : null,
        ]}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  pillShadow: {
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  label: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  ghostPressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});

/** Variant-dependent fill/border — computed per render, so kept outside the sheet. */
const altFill = (backgroundColor: string, borderColor: string) => ({ backgroundColor, borderColor });
