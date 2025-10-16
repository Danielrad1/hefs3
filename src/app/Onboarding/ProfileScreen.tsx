import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Alert, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import PrimaryButton from '../../components/PrimaryButton';

interface ProfileData {
  displayName: string;
  firstName: string;
  lastName?: string;
}

interface ProfileScreenProps {
  onContinue: (data: ProfileData) => void;
  onSkip: () => void;
}

export default function ProfileScreen({ onContinue, onSkip }: ProfileScreenProps) {
  const theme = useTheme();
  const [firstName, setFirstName] = useState('');

  const handleContinue = () => {
    if (!firstName.trim()) {
      Alert.alert('Name Required', 'Please enter your name');
      return;
    }
    
    onContinue({
      displayName: firstName.trim(),
      firstName: firstName.trim(),
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.stepText, { color: theme.colors.textTertiary }]}>
            Step 1 of 4
          </Text>
        </View>

        <View style={styles.content}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent + '20' }]}>
              <Ionicons name="person" size={32} color={theme.colors.accent} />
            </View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              What's your name?
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Help us personalize your experience
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
                First Name
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                }]}
                placeholder="What should we call you?"
                placeholderTextColor={theme.colors.textTertiary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleContinue}
              />
            </View>
          </View>
          <View style={styles.actions}>
            <PrimaryButton
              title="Continue →"
              onPress={handleContinue}
            />
            <Pressable onPress={onSkip} style={{ paddingVertical: s.md, alignItems: 'center' }}>
              <Text style={[{ color: theme.colors.textSecondary, fontSize: 15, fontWeight: '500' }]}>
                Skip
              </Text>
            </Pressable>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: s.xl,
    justifyContent: 'space-between',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: s.xl * 2,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: s.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  form: {
    gap: s.lg,
    flex: 1,
  },
  inputGroup: {
    gap: s.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    paddingHorizontal: s.lg,
    paddingVertical: s.lg,
    borderRadius: r.md,
    fontSize: 16,
    borderWidth: 1,
  },
  actions: {
    gap: s.sm,
  },
});
