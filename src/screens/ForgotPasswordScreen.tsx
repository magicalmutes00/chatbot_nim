import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { radius, spacing, type ThemeColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={colors.heroGradient} style={styles.hero}>
          <Text style={styles.heroTitle}>Reset password</Text>
          <Text style={styles.heroSub}>We'll email you a link to pick a new one.</Text>
        </LinearGradient>

        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <Input
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            {status ? (
              <Text style={[styles.status, status.kind === 'err' && { color: colors.danger }]}>
                {status.msg}
              </Text>
            ) : null}

            <View style={styles.gapLg} />
            <Button title={loading ? 'Sending…' : 'Send reset email'} onPress={handleReset} loading={loading} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgBaseAlt },
    scroll: { flexGrow: 1 },
    hero: {
      alignItems: 'center',
      paddingTop: spacing.xxl * 3,
      paddingBottom: spacing.xl + spacing.lg,
      paddingHorizontal: spacing.xl,
    },
    heroTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
    heroSub: { color: colors.textSecondary, marginTop: 5, fontSize: 14, textAlign: 'center' },
    cardWrap: { flex: 1, paddingHorizontal: spacing.xl },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      padding: spacing.xl,
      marginTop: -spacing.xl - 4,
      shadowColor: '#050b1c',
      shadowOpacity: 0.35,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    gapLg: { height: spacing.lg },
    status: { color: colors.textSecondary, marginTop: spacing.md, fontSize: 13 },
  });
