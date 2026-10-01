import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { NIM_MODELS, DEFAULT_MODEL_ID } from '../config/nimModels';
import { Background } from '../components/Background';
import { Surface } from '../components/Surface';
import { Button } from '../components/Button';
import { radius, spacing, type ThemeColors, type ThemeMode } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<MainStackParamList, 'Settings'>;

const MODES: { id: ThemeMode; glyph: string; label: string }[] = [
  { id: 'light', glyph: '☀', label: 'Light' },
  { id: 'dark', glyph: '☾', label: 'Dark' },
];

export default function SettingsScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Background>
      <View style={styles.topBar}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()} style={styles.backChip}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={styles.backChip} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Surface style={styles.section} radius={radius.lg}>
          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={styles.segmentRow}>
            {MODES.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMode(m.id)}
                style={[styles.segment, mode === m.id && styles.segmentActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m.id }}
              >
                <Text
                  style={[styles.segmentGlyph, mode === m.id && styles.segmentTextActive]}
                >
                  {m.glyph}
                </Text>
                <Text style={[styles.segmentText, mode === m.id && styles.segmentTextActive]}>
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Surface>

        <Surface style={styles.section} radius={radius.lg}>
          <Text style={styles.sectionLabel}>Account</Text>
          <Text style={styles.value}>{user?.email ?? '—'}</Text>
        </Surface>

        <Surface style={styles.section} radius={radius.lg}>
          <Text style={styles.sectionLabel}>Models</Text>
          <Text style={styles.value}>
            Default: {NIM_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)?.label ?? DEFAULT_MODEL_ID}
          </Text>
          <View style={styles.gapSm} />
          {NIM_MODELS.map((m) => (
            <Text key={m.id} style={styles.modelRow}>
              · {m.label}
              {m.kind === 'image' ? '  (image)' : ''}
            </Text>
          ))}
        </Surface>

        <Text style={styles.version}>Trisentric AI · v1.0</Text>

        <View style={styles.gapXl} />
        <Button title="Log out" onPress={() => signOut()} variant="destructive" />
      </ScrollView>
    </Background>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.xxl + spacing.md,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    backChip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { color: colors.textPrimary, fontSize: 24, lineHeight: 28, marginTop: -2 },
    topBarTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '800',
      flex: 1,
      textAlign: 'center',
    },
    container: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
    section: { padding: spacing.lg + 2, marginBottom: spacing.md },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    segmentRow: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceMuted,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: 3,
    },
    segment: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: radius.pill,
      gap: 6,
    },
    segmentActive: { backgroundColor: colors.accent },
    segmentGlyph: { color: colors.textSecondary, fontSize: 13 },
    segmentText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '700',
    },
    segmentTextActive: { color: colors.textPrimary },
    value: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
    gapSm: { height: spacing.sm },
    gapXl: { height: spacing.xl },
    modelRow: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
    version: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: 'center',
      marginTop: spacing.lg,
      letterSpacing: 0.5,
    },
  });
