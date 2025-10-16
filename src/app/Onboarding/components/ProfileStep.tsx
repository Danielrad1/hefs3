import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import PrimaryButton from '../../../components/PrimaryButton';

interface ProfileStepProps {
  onNext: (data: { profile: { displayName: string; firstName: string } }) => void;
  onBack?: () => void;
}

export default function ProfileStep({ onNext, onBack }: ProfileStepProps) {
  const theme = useTheme();
  const [name, setName] = useState('');

  const handleContinue = () => {
    const finalName = name.trim() || 'there';
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext({
      profile: {
        displayName: finalName,
        firstName: finalName,
      },
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? -50 : 0}
    >
      {onBack && (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      )}

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent + '20' }]}>
            <Ionicons name="person" size={32} color={theme.colors.accent} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            What should we call you?
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Help us personalize your experience
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, { 
              backgroundColor: theme.colors.surface,
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
            }]}
            placeholder="Enter your name"
            placeholderTextColor={theme.colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
        <PrimaryButton
          title="Continue →"
          onPress={handleContinue}
        />
        <Pressable onPress={() => onNext({ profile: { displayName: 'there', firstName: 'there' } })} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>
            Skip
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    padding: s.md,
    paddingLeft: s.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: s.xl,
    paddingTop: s.xl,
    paddingBottom: s.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: s.xl,
    gap: s.sm,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: r.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    gap: s.lg,
  },
  input: {
    paddingHorizontal: s.lg,
    paddingVertical: s.lg,
    borderRadius: r.lg,
    fontSize: 18,
    borderWidth: 1.5,
    minHeight: 56,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: s.xl,
    paddingVertical: s.lg,
    paddingBottom: s.xl,
    borderTopWidth: 1,
    gap: s.sm,
  },
  skipButton: {
    paddingVertical: s.md,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
