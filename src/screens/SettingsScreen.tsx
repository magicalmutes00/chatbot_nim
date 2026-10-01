import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
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

const MODES: ThemeMode[] = ['light', 'dark'];

export default function SettingsScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const { colors, mode, setMode } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Background>
      <View style={styles.topBar}>
        <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>Settings</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <View style={styles.container}>
        <Surface style={styles.section} radius={radius.lg}>
          <Text style={styles.sectionLabel}>Appearance</Text>
          <View style={styles.segmentRow}>
            {MODES.map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={[styles.segment, mode === m && styles.segmentActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === m }}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === 'light' ? 'Light' : 'Dark'}
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
          <View style={{ height: spacing.sm }} />
          {NIM_MODELS.map((m) => (
            <Text key={m.id} style={styles.modelRow}>
              · {m.label}
            </Text>
          ))}
        </Surface>

        <View style={{ height: spacing.xl }} />
        <Button title="Log out" onPress={() => signOut()} variant="destructive" />
      </View>
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
    backIcon: { color: colors.textPrimary, fontSize: 30, lineHeight: 34 },
    topBarTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
      flex: 1,
      textAlign: 'center',
    },
    topBarSpacer: { width: 30 },
    container: { flex: 1, padding: spacing.lg, paddingTop: spacing.md },
    section: { padding: spacing.lg, marginBottom: spacing.md },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      letterSpacing: 1.2,
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
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: radius.pill,
    },
    segmentActive: { backgroundColor: colors.accent },
    segmentText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '600',
    },
    segmentTextActive: { color: colors.textPrimary },
    value: { color: colors.textPrimary, fontSize: 16 },
    modelRow: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  });
