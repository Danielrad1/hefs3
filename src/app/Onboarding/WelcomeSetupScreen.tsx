import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import PrimaryButton from '../../components/PrimaryButton';
import * as Haptics from 'expo-haptics';

interface WelcomeSetupScreenProps {
  onComplete: () => void;
}

export default function WelcomeSetupScreen({ onComplete }: WelcomeSetupScreenProps) {
  const theme = useTheme();

  const handleGetStarted = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: theme.colors.accent + '20' }]}>
            <Ionicons name="checkmark-circle" size={80} color={theme.colors.accent} />
          </View>
        </View>

        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Welcome to Enqode!
        </Text>

        <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
          You're all set! Here's how to get started:
        </Text>

        <View style={styles.stepsContainer}>
          <View style={styles.step}>
            <View style={[styles.stepIcon, { backgroundColor: theme.colors.accent + '15' }]}>
              <Ionicons name="albums" size={24} color={theme.colors.accent} />
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>
                Go to Decks
              </Text>
              <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Import your own deck or create one with AI
              </Text>
            </View>
          </View>

          <View style={styles.step}>
            <View style={[styles.stepIcon, { backgroundColor: theme.colors.accent + '15' }]}>
              <Ionicons name="compass" size={24} color={theme.colors.accent} />
            </View>
            <View style={styles.stepText}>
              <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>
                Check Discover
              </Text>
              <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                Browse our curated list of popular decks
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.footer, { color: theme.colors.textTertiary }]}>
          The rest is easy to get. Happy studying! 🎉
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <PrimaryButton
          title="Get Started"
          onPress={handleGetStarted}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: s.xl,
    paddingTop: s.xl * 2,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: s.xl * 2,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: s.lg,
    textAlign: 'center',
  },
  description: {
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: s.xl * 2,
    maxWidth: 320,
  },
  stepsContainer: {
    width: '100%',
    gap: s.lg,
    marginBottom: s.xl * 2,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s.md,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    flex: 1,
    paddingTop: s.xs,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    fontSize: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    paddingHorizontal: s.xl,
    paddingBottom: s.xl,
  },
});
