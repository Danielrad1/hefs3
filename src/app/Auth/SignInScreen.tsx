import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { LinearGradient } from 'expo-linear-gradient';

export default function SignInScreen() {
  const { signInWithEmail, signUpWithEmail, signInAnonymously } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleEmailAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      setLoading('email');
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error: any) {
      const message = error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password'
        ? 'Invalid email or password'
        : error.message || 'Authentication failed';
      Alert.alert(isSignUp ? 'Sign Up Failed' : 'Sign In Failed', message);
    } finally {
      setLoading(null);
    }
  };

  const handleContinueAsGuest = async () => {
    try {
      setLoading('guest');
      await signInAnonymously();
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Could not continue as guest');
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[theme.colors.accent, theme.colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconContainer}
          >
            <Ionicons name="school" size={48} color="#000" />
          </LinearGradient>
          
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Welcome to Memorize
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Master anything with spaced repetition
          </Text>
        </View>

        {/* Email/Password Form */}
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.formContainer}
        >
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
            }]}
            placeholder="Email"
            placeholderTextColor={theme.colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={loading === null}
          />
          
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
            }]}
            placeholder="Password"
            placeholderTextColor={theme.colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={loading === null}
          />

          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
            onPress={handleEmailAuth}
            disabled={loading !== null}
          >
            {loading === 'email' ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.switchButton}
            onPress={() => setIsSignUp(!isSignUp)}
            disabled={loading !== null}
          >
            <Text style={[styles.switchButtonText, { color: theme.colors.accent }]}>
              {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
            </Text>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          <Pressable
            style={styles.guestButton}
            onPress={handleContinueAsGuest}
            disabled={loading !== null}
          >
            {loading === 'guest' ? (
              <ActivityIndicator color={theme.colors.textSecondary} />
            ) : (
              <Text style={[styles.guestButtonText, { color: theme.colors.textSecondary }]}>
                Continue as Guest
              </Text>
            )}
          </Pressable>
        </KeyboardAvoidingView>

        {/* Benefits */}
        <View style={styles.benefits}>
          <BenefitItem
            icon="cloud-upload-outline"
            text="Backup your decks to the cloud"
            theme={theme}
          />
          <BenefitItem
            icon="sync-outline"
            text="Sync across all your devices"
            theme={theme}
          />
          <BenefitItem
            icon="compass-outline"
            text="Discover premium curated decks"
            theme={theme}
          />
        </View>

        {/* Privacy Note */}
        <Text style={[styles.privacyNote, { color: theme.colors.textTertiary }]}>
          By signing in, you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

interface BenefitItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  theme: any;
}

function BenefitItem({ icon, text, theme }: BenefitItemProps) {
  return (
    <View style={styles.benefitItem}>
      <Ionicons name={icon} size={20} color={theme.colors.accent} />
      <Text style={[styles.benefitText, { color: theme.colors.textSecondary }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: s.xl,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: s.xl * 2,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: r.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: s.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  formContainer: {
    gap: s.md,
    marginBottom: s.xl,
  },
  input: {
    paddingHorizontal: s.lg,
    paddingVertical: s.lg,
    borderRadius: r.md,
    fontSize: 16,
    borderWidth: 1,
  },
  primaryButton: {
    paddingVertical: s.lg,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  switchButton: {
    paddingVertical: s.sm,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: s.md,
  },
  guestButton: {
    paddingVertical: s.md,
    alignItems: 'center',
  },
  guestButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  benefits: {
    gap: s.md,
    marginBottom: s.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  benefitText: {
    fontSize: 14,
    flex: 1,
  },
  privacyNote: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
