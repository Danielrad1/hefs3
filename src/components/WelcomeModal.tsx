import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';
import PrimaryButton from './PrimaryButton';
import * as Haptics from 'expo-haptics';

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function WelcomeModal({ visible, onClose }: WelcomeModalProps) {
  const theme = useTheme();

  const handleClose = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable 
        style={styles.backdrop}
        onPress={handleClose}
      >
        <Pressable 
          style={[styles.modal, { backgroundColor: theme.colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.content}>
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.accent + '20' }]}>
              <Ionicons name="checkmark-circle" size={64} color={theme.colors.accent} />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Welcome to Enqode!
            </Text>

            {/* Description */}
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
              You're all set! Here's how to get started:
            </Text>

            {/* Steps */}
            <View style={styles.stepsContainer}>
              <View style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: theme.colors.accent + '15' }]}>
                  <Ionicons name="albums" size={20} color={theme.colors.accent} />
                </View>
                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>
                    Go to Decks tab
                  </Text>
                  <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                    Import your own deck or create one with AI
                  </Text>
                </View>
              </View>

              <View style={styles.step}>
                <View style={[styles.stepIcon, { backgroundColor: theme.colors.accent + '15' }]}>
                  <Ionicons name="compass" size={20} color={theme.colors.accent} />
                </View>
                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, { color: theme.colors.textPrimary }]}>
                    Check Discover tab
                  </Text>
                  <Text style={[styles.stepDescription, { color: theme.colors.textSecondary }]}>
                    Browse our curated list of popular decks
                  </Text>
                </View>
              </View>
            </View>

            {/* Footer */}
            <Text style={[styles.footer, { color: theme.colors.textTertiary }]}>
              The rest is easy to get. Happy studying! 🎉
            </Text>
          </View>

          {/* Button */}
          <View style={styles.buttonContainer}>
            <PrimaryButton
              title="Got it!"
              onPress={handleClose}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.xl,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: r.lg,
    padding: s.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: s.md,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: s.lg,
  },
  stepsContainer: {
    width: '100%',
    gap: s.md,
    marginBottom: s.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s.sm,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    marginTop: s.lg,
  },
});
