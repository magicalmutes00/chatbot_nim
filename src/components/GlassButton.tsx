import React from 'react';
import { StyleSheet, Text, View, Pressable, ViewStyle } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { colors, radius } from '../theme/glass';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  style?: ViewStyle;
}

/**
 * The only frosted-glass element in the UI: a BlurView pill with a
 * translucent overlay and hairline border. Everything else in the app is a
 * plain white/light surface.
 */
export function GlassButton({
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
}: GlassButtonProps) {
  const [pressed, setPressed] = React.useState(false);

  const overlay =
    variant === 'primary'
      ? colors.accentSoft
      : variant === 'destructive'
        ? 'rgba(255,59,92,0.14)'
        : pressed
          ? 'rgba(13,18,32,0.08)'
          : 'rgba(255,255,255,0.35)';

  const tint =
    variant === 'primary'
      ? colors.accent
      : variant === 'destructive'
        ? colors.danger
        : colors.textPrimary;

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
          { borderColor: variant === 'ghost' ? colors.glassBorderSubtle : colors.glassBorder },
        ]}
      >
        <BlurView
          blurType="light"
          blurAmount={30}
          reducedTransparencyFallbackColor="#ffffff"
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.inner, { backgroundColor: overlay }]}>
          <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
            {loading ? '…' : title}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillShadow: {
    shadowColor: '#0d1220',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inner: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
});
