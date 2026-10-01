import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { radius, spacing, type ThemeColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import { NIM_MODELS } from '../config/nimModels';
import Logo from '../assets/logo.png';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { signIn, signInWithGoogle } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code !== 'SIGN_IN_CANCELLED' && err?.message !== 'SIGN_IN_CANCELLED') {
        setError(err?.message ?? 'Google sign-in failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={colors.heroGradient} style={styles.hero}>
          <Image source={Logo} style={styles.logoImage} resizeMode="contain" />
          <Text style={styles.brandSub}>
            Chat with NVIDIA NIM models — {NIM_MODELS.length} available
          </Text>
        </LinearGradient>

        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <Text style={styles.heading}>Welcome back</Text>
            <Text style={styles.subheading}>Sign in to continue your conversations</Text>

            <View style={styles.gapLg} />
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
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.gapLg} />
            <Button title={loading ? 'Signing in…' : 'Sign in'} onPress={handleLogin} loading={loading} />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Continue with Google"
              onPress={handleGoogleSignIn}
              loading={googleLoading}
              variant="secondary"
            />

            <Pressable onPress={() => navigation.navigate('ForgotPassword')} hitSlop={8} style={styles.forgot}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8} style={styles.footnoteWrap}>
            <Text style={styles.footnote}>
              New here? <Text style={styles.link}>Create an account</Text>
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
      paddingBottom: spacing.xxl + spacing.lg,
      paddingHorizontal: spacing.xl,
    },
    logoImage: { width: 200, height: 60, marginBottom: spacing.md },
    brandSub: { color: colors.accent2, fontSize: 13, letterSpacing: 0.2, fontWeight: '500' },
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
    heading: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
    subheading: { color: colors.textSecondary, marginTop: 5, fontSize: 14 },
    error: { color: colors.danger, marginTop: spacing.md, fontSize: 13 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
    dividerText: { color: colors.textMuted, marginHorizontal: spacing.md, fontSize: 12 },
    forgot: { alignItems: 'center', marginTop: spacing.lg },
    footnoteWrap: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xxl },
    footnote: { color: colors.textSecondary, textAlign: 'center', fontSize: 14 },
    link: { color: colors.accent2, fontWeight: '700' },
  });
