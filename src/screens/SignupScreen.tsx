import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { GlassSurface } from '../components/GlassSurface';
import { GlassButton } from '../components/GlassButton';
import { GlassInput } from '../components/GlassInput';
import { colors, radius, spacing } from '../theme/glass';

type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const { signUp } = useAuth();
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <GlassSurface style={styles.card} radius={radius.xl}>
          <View style={styles.cardInner}>
            <Text style={styles.heading}>Create your account</Text>
            <Text style={styles.subheading}>Start chatting in under a minute</Text>

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
              placeholder="At least 6 characters"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={{ height: spacing.lg }} />
            <GlassButton title={loading ? 'Creating…' : 'Create account'} onPress={handleSignup} loading={loading} />
          </View>
        </GlassSurface>

        <Pressable onPress={() => navigation.navigate('Login')} hitSlop={8} style={{ marginTop: spacing.xl }}>
          <Text style={styles.footnote}>
            Already have an account? <Text style={styles.link}>Sign in</Text>
          </Text>
        </Pressable>
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
  error: { color: colors.danger, marginTop: spacing.md, fontSize: 13 },
  footnote: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
  link: { color: colors.accent, fontWeight: '600' },
});
