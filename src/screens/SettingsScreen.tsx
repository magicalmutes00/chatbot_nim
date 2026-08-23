import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { NIM_MODELS, DEFAULT_MODEL_ID } from '../config/nimModels';
import { GlassSurface } from '../components/GlassSurface';
import { GlassButton } from '../components/GlassButton';
import { colors, radius, spacing } from '../theme/glass';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <GlassSurface style={styles.section} radius={radius.lg}>
        <Text style={styles.sectionLabel}>Account</Text>
        <Text style={styles.value}>{user?.email ?? '—'}</Text>
      </GlassSurface>

      <GlassSurface style={styles.section} radius={radius.lg}>
        <Text style={styles.sectionLabel}>Default model</Text>
        <Text style={styles.value}>
          {NIM_MODELS.find((m) => m.id === DEFAULT_MODEL_ID)?.label ?? DEFAULT_MODEL_ID}
        </Text>
        <View style={{ height: spacing.sm }} />
        {NIM_MODELS.map((m) => (
          <Text key={m.id} style={styles.modelRow}>
            · {m.label}
          </Text>
        ))}
      </GlassSurface>

      <View style={{ height: spacing.xl }} />
      <GlassButton title="Log out" onPress={() => signOut()} variant="destructive" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, paddingTop: spacing.md },
  section: { padding: spacing.lg, marginBottom: spacing.md },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  value: { color: colors.textPrimary, fontSize: 16 },
  modelRow: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
