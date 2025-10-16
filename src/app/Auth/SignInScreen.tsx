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
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { LinearGradient } from 'expo-linear-gradient';
import { isUserCancellation } from '../../utils/authErrors';

const { width } = Dimensions.get('window');

interface SignInScreenProps {
  onBack: () => void;
  onSignUp: () => void;
}

export default function SignInScreen({ onBack, onSignUp }: SignInScreenProps) {
  const { signInWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    try {
      setLoading('email');
      await signInWithEmail(email, password);
    } catch (error: any) {
      Alert.alert('Sign In Failed', error.message || 'Could not sign in');
    } finally {
      setLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading('apple');
      await signInWithApple();
    } catch (error: any) {
      if (!isUserCancellation(error)) {
        Alert.alert('Sign In Failed', error.message || 'Could not sign in with Apple');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading('google');
      await signInWithGoogle();
    } catch (error: any) {
      if (!isUserCancellation(error)) {
        Alert.alert('Sign In Failed', error.message || 'Could not sign in with Google');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={28} color={theme.colors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {/* Title */}
          <Animated.View entering={FadeInUp.delay(100)} style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Welcome back
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Sign in to continue learning
            </Text>
          </Animated.View>

          <View style={styles.authContainer}>
            {/* Provider Buttons */}
            {!showEmailForm && (
              <Animated.View entering={FadeInDown.delay(200)} style={styles.providerButtons}>

                {/* Apple Sign-In (iOS only) */}
                {Platform.OS === 'ios' && (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={16}
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                  />
                )}

                {/* Google Sign-In */}
                <Pressable
                  style={({ pressed }) => [
                    styles.socialButton,
                    { 
                      backgroundColor: theme.colors.surface,
                      opacity: pressed ? 0.7 : 1,
                    }
                  ]}
                  onPress={handleGoogleSignIn}
                  disabled={loading !== null}
                >
                  {loading === 'google' ? (
                    <ActivityIndicator color={theme.colors.textPrimary} />
                  ) : (
                    <>
                      <View style={[styles.socialIconContainer, { backgroundColor: '#FFFFFF' }]}>
                        <Ionicons name="logo-google" size={22} color="#DB4437" />
                      </View>
                      <Text style={[styles.socialButtonText, { color: theme.colors.textPrimary }]}>
                        Continue with Google
                      </Text>
                    </>
                  )}
                </Pressable>

                {/* Divider */}
                <View style={styles.dividerContainer}>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                  <Text style={[styles.dividerText, { color: theme.colors.textTertiary }]}>
                    or continue with email
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                </View>

                {/* Email Option */}
                <Pressable
                  style={({ pressed }) => [
                    styles.emailButton,
                    { 
                      backgroundColor: theme.colors.accent,
                      opacity: pressed ? 0.8 : 1,
                    }
                  ]}
                  onPress={() => setShowEmailForm(true)}
                >
                  <Ionicons name="mail" size={22} color="#0A0A0B" />
                  <Text style={styles.emailButtonText}>
                    Sign In with Email
                  </Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Email/Password Form */}
            {showEmailForm && (
              <View style={styles.emailForm}>
                <Pressable
                  style={styles.backButton}
                  onPress={() => {
                    setShowEmailForm(false);
                    setEmail('');
                    setPassword('');
                    setIsSignUp(false);
                  }}
                >
                  <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
                </Pressable>

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
                  autoFocus
                />
                
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.textPrimary,
                    borderColor: theme.colors.border,
                  }]}
                  placeholder="Password (min 6 characters)"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={loading === null}
                />

                <Pressable
                  style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
                  onPress={handleEmailSignIn}
                  disabled={loading !== null}
                >
                  {loading === 'email' ? (
                    <ActivityIndicator color="#0A0A0B" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Sign In
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={styles.backToOptionsButton}
                  onPress={() => {
                    setShowEmailForm(false);
                    setEmail('');
                    setPassword('');
                  }}
                >
                  <Text style={[styles.backToOptionsText, { color: theme.colors.accent }]}>
                    ← Back to sign in options
                  </Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Switch to Sign Up */}
          <Pressable style={styles.switchButton} onPress={onSignUp}>
            <Text style={[styles.switchButtonText, { color: theme.colors.textSecondary }]}>
              Don't have an account?{' '}
              <Text style={[styles.switchButtonTextBold, { color: theme.colors.accent }]}>
                Sign Up
              </Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: s.lg,
    paddingTop: s.md,
  },
  backButton: {
    padding: s.sm,
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    paddingHorizontal: s.xl,
    paddingBottom: s.xl,
    justifyContent: 'space-between',
  },
  titleSection: {
    paddingTop: s.xl,
    gap: s.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '500',
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  providerButtons: {
    gap: s.lg,
  },
  ctaText: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: s.sm,
  },
  appleButton: {
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s.lg,
    paddingHorizontal: s.xl,
    borderRadius: r.lg,
    gap: s.md,
    minHeight: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  socialIconContainer: {
    width: 32,
    height: 32,
    borderRadius: r.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    marginVertical: s.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s.lg,
    paddingHorizontal: s.xl,
    borderRadius: r.lg,
    gap: s.md,
    minHeight: 60,
    shadowColor: '#6EE7F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  emailButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A0A0B',
  },
  emailForm: {
    gap: s.lg,
    flex: 1,
    justifyContent: 'center',
  },
  backToOptionsButton: {
    paddingVertical: s.sm,
    alignItems: 'center',
  },
  backToOptionsText: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    paddingHorizontal: s.lg,
    paddingVertical: s.lg,
    borderRadius: r.lg,
    fontSize: 16,
    borderWidth: 1.5,
    minHeight: 56,
  },
  primaryButton: {
    paddingVertical: s.lg,
    borderRadius: r.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    shadowColor: '#6EE7F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0A0A0B',
  },
  switchButton: {
    paddingVertical: s.lg,
    alignItems: 'center',
  },
  switchButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  switchButtonTextBold: {
    fontWeight: '700',
  },
});
