import React, { useState, useEffect } from 'react';
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
import * as AppleAuthentication from 'expo-apple-authentication';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { LinearGradient } from 'expo-linear-gradient';
import { isUserCancellation } from '../../utils/authErrors';
import { GoogleLogo } from '../../components/GoogleLogo';

interface SignUpScreenProps {
  onBack: () => void;
  onSignIn: () => void;
}

export default function SignUpScreen({ onBack, onSignIn }: SignUpScreenProps) {
  const { signUpWithEmail, signInWithApple, signInWithGoogle } = useAuth();
  const theme = useTheme();
  
  // Force sunset theme for sign-up screen
  useEffect(() => {
    theme.setColorScheme('sunset');
  }, []);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleEmailSignUp = async () => {
    // Clear previous errors
    setEmailError(null);
    setPasswordError(null);

    // Validate email format
    const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!email || !emailValid) {
      setEmailError('Enter a valid email');
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      Alert.alert('Weak Password', 'Password must be at least 6 characters');
      return;
    }

    // Validate password match
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      Alert.alert('Passwords Do Not Match', 'Please ensure both passwords match');
      return;
    }

    try {
      setLoading('email');
      await signUpWithEmail(email, password);
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Could not create account');
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
        Alert.alert('Sign Up Failed', error.message || 'Could not sign up with Apple');
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
        Alert.alert('Sign Up Failed', error.message || 'Could not sign up with Google');
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
              Create your account
            </Text>
          </Animated.View>

          {!showEmailForm ? (
            <Animated.View entering={FadeInDown.delay(150)} style={styles.authOptions}>
              {/* Apple Sign-In (iOS only) */}
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={12}
                  style={styles.appleButton}
                  onPress={handleAppleSignIn}
                />
              )}

              {/* Google Sign-Up */}
              <Pressable
                style={({ pressed }) => [
                  styles.socialButton,
                  { 
                    backgroundColor: '#000000',
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
                    <View style={styles.googleIconContainer}>
                      <GoogleLogo size={22} />
                    </View>
                    <Text style={[styles.buttonText, { color: '#FFFFFF' }]}>
                      Continue with Google
                    </Text>
                  </>
                )}
              </Pressable>

              {/* Divider */}
              <View style={styles.dividerContainer}>
                <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
                <Text style={[styles.dividerText, { color: theme.colors.textTertiary }]}>
                  or sign up with email
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
                <Text style={styles.buttonText}>
                  Sign Up with Email
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            // Email Form
            <View style={styles.emailForm}>
              <View>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.textPrimary,
                    borderColor: emailError ? '#FF6B6B' : theme.colors.border,
                  }]}
                  placeholder="Email"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setEmailError(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={loading === null}
                  autoFocus
                />
                {emailError && (
                  <Text style={[styles.errorText, { color: '#FF6B6B' }]}>
                    {emailError}
                  </Text>
                )}
              </View>
              
              <View>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.textPrimary,
                    borderColor: passwordError ? '#FF6B6B' : theme.colors.border,
                  }]}
                  placeholder="Password (min 6 characters)"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setPasswordError(null);
                  }}
                  secureTextEntry
                  editable={loading === null}
                />
              </View>

              <View>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: theme.colors.surface,
                    color: theme.colors.textPrimary,
                    borderColor: passwordError ? '#FF6B6B' : theme.colors.border,
                  }]}
                  placeholder="Confirm password"
                  placeholderTextColor={theme.colors.textTertiary}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setPasswordError(null);
                  }}
                  secureTextEntry
                  editable={loading === null}
                />
                {passwordError && (
                  <Text style={[styles.errorText, { color: '#FF6B6B' }]}>
                    {passwordError}
                  </Text>
                )}
              </View>

              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
                onPress={handleEmailSignUp}
                disabled={loading !== null}
              >
                {loading === 'email' ? (
                  <ActivityIndicator color="#0A0A0B" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    Create Account
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.backToOptionsButton}
                onPress={() => {
                  setShowEmailForm(false);
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                  setEmailError(null);
                  setPasswordError(null);
                }}
              >
                <Text style={[styles.backToOptionsText, { color: theme.colors.accent }]}>
                  ← Back to sign up options
                </Text>
              </Pressable>
            </View>
          )}

          {/* Switch to Sign In */}
          <Pressable style={styles.switchButton} onPress={onSignIn}>
            <Text style={[styles.switchButtonText, { color: theme.colors.textSecondary }]}>
              Already have an account?{' '}
              <Text style={[styles.switchButtonTextBold, { color: theme.colors.accent }]}>
                Sign In
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
  authOptions: {
    gap: s.lg,
    flex: 1,
    justifyContent: 'center',
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
    paddingHorizontal: s.xl,
    borderRadius: 12,
    gap: s.sm,
    height: 60,
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
  googleIconContainer: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    marginVertical: s.sm,
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
  emailForm: {
    gap: s.lg,
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    paddingHorizontal: s.lg,
    paddingVertical: s.lg,
    borderRadius: r.lg,
    fontSize: 16,
    borderWidth: 1.5,
    minHeight: 56,
  },
  errorText: {
    fontSize: 12,
    marginTop: s.xs,
    marginLeft: s.sm,
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
  backToOptionsButton: {
    paddingVertical: s.sm,
    alignItems: 'center',
  },
  backToOptionsText: {
    fontSize: 15,
    fontWeight: '600',
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
