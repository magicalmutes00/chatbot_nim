import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { radius, spacing, type ThemeColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);
    setLoading(true);
    try {
      await signUp(email.trim(), password);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={colors.heroGradient} style={styles.hero}>
          <Text style={styles.heroTitle}>Create your account</Text>
          <Text style={styles.heroSub}>Start chatting in under a minute</Text>
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
            <View style={styles.gapMd} />
            <Input
              label="Password"
              placeholder="At least 6 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.gapLg} />
            <Button title={loading ? 'Creating…' : 'Create account'} onPress={handleSignup} loading={loading} />
          </View>

          <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={styles.footnoteWrap}>
            <Text style={styles.footnote}>
              Already have an account? <Text style={styles.link}>Sign in</Text>
            </Text>
          </Pressable>
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
    heroSub: { color: colors.textSecondary, marginTop: 5, fontSize: 14 },
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
    gapMd: { height: spacing.md },
    error: { color: colors.danger, marginTop: spacing.md, fontSize: 13 },
    footnoteWrap: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xxl },
    footnote: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
    link: { color: colors.accent2, fontWeight: '700' },
  });
