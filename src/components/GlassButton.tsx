import React from 'react';
import { StyleSheet, Text, View, Pressable, ViewStyle } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { colors, radius } from '../theme/glass';

interface GlassButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  style?: ViewStyle;
}

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
        ? 'rgba(255,84,112,0.18)'
        : pressed
          ? 'rgba(255,255,255,0.18)'
          : 'transparent';

  const tint =
    variant === 'primary' ? colors.accent : variant === 'destructive' ? colors.danger : colors.textPrimary;

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
      <GlassSurface
        radius={radius.pill}
        tone={variant === 'ghost' ? 'lighter' : 'light'}
        border
        shadow={variant !== 'ghost'}
        intensity={variant === 'ghost' ? 30 : 40}
        style={{ borderRadius: radius.pill }}
      >
        <View style={[styles.inner, { backgroundColor: overlay }]}>
          <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
            {loading ? '…' : title}
          </Text>
        </View>
      </GlassSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: { paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center', borderRadius: radius.pill },
  label: { fontSize: 16, fontWeight: '600', letterSpacing: 0.2 },
});