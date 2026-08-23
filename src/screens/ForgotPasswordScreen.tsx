import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { GlassSurface } from '../components/GlassSurface';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { colors, radius, spacing } from '../theme/glass';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setStatus(null);
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setStatus({ kind: 'ok', msg: 'Check your email for a reset link.' });
    } catch (err: any) {
      setStatus({ kind: 'err', msg: err?.message ?? 'Failed to send reset email' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <GlassSurface style={styles.card} radius={radius.xl}>
          <View style={styles.cardInner}>
            <Text style={styles.heading}>Reset password</Text>
            <Text style={styles.subheading}>We'll email you a link to pick a new one.</Text>

            <View style={{ height: spacing.lg }} />
            <GlassInput
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            {status ? (
              <Text style={[styles.status, status.kind === 'err' && { color: colors.danger }]}>{status.msg}</Text>
            ) : null}

            <View style={{ height: spacing.lg }} />
            <GlassButton title={loading ? 'Sending…' : 'Send reset email'} onPress={handleReset} loading={loading} />
          </View>
        </GlassSurface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  card: {},
  cardInner: { padding: spacing.xl },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  subheading: { color: colors.textSecondary, marginTop: 4, fontSize: 14 },
  status: { color: colors.textSecondary, marginTop: spacing.md, fontSize: 13 },
});
