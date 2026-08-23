import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { GlassSurface } from '../components/GlassSurface';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { colors, radius, spacing } from '../theme/glass';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signIn, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <Text style={styles.brandTitle}>NimChat</Text>
          <Text style={styles.brandSub}>Chat with NVIDIA NIM models</Text>
        </View>

        <GlassSurface style={styles.card} radius={radius.xl}>
          <View style={styles.cardInner}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to continue your conversations</Text>

            <View style={{ height: spacing.lg }} />
            <GlassInput
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <View style={{ height: spacing.md }} />
            <GlassInput
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={{ height: spacing.lg }} />
            <GlassButton title={loading ? 'Signing in…' : 'Sign in'} onPress={handleLogin} loading={loading} />

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8} style={styles.forgot}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>
        </GlassSurface>

        <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8} style={{ marginTop: spacing.xl }}>
          <Text style={styles.footnote}>
            New here? <Text style={styles.link}>Create an account</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  brand: { alignItems: 'center', marginBottom: spacing.xxl },
  brandTitle: {
    color: colors.textPrimary,
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  brandSub: { color: colors.textSecondary, marginTop: 6, fontSize: 14, letterSpacing: 0.3 },
  card: {},
  cardInner: { padding: spacing.xl },
  heading: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  subheading: { color: colors.textSecondary, marginTop: 4, fontSize: 14 },
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13 },
  forgot: { alignItems: 'center', marginTop: spacing.lg },
  footnote: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
  link: { color: colors.accent, fontWeight: '600' },
});