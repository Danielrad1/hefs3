import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';

interface HintsSuccessModalProps {
  visible: boolean;
  cardsWithHints: number;
  deckName?: string;
  onStudyNow: () => void;
  onClose: () => void;
}

export default function HintsSuccessModal({ visible, cardsWithHints, deckName, onStudyNow, onClose }: HintsSuccessModalProps) {
  const theme = useTheme();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const deckLabel = deckName ? `“${deckName}”` : 'this deck';

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      fadeAnim.setValue(0);
    }
  }, [visible, scaleAnim, fadeAnim]);

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
            <Ionicons name="bulb" size={48} color="#8B5CF6" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            ✨ AI Hints Enabled!
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
            {cardsWithHints} cards in {deckLabel} now have smart hints ready to go.
          </Text>

          {/* CTA */}
          <Text style={[styles.cta, { color: theme.colors.textPrimary }]}>
            You can study this deck right now and start using the new hints.
          </Text>

          {/* Buttons */}
          <View style={styles.buttons}>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.colors.accent }]}
              onPress={onStudyNow}
            >
              <Ionicons name="book" size={20} color="#000" style={{ marginRight: s.xs }} />
              <Text style={styles.primaryButtonText}>Study This Deck</Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.colors.border }]}
              onPress={onClose}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.colors.textPrimary }]}>
                Later
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '85%',
    maxWidth: 400,
    padding: s.xl,
    borderRadius: r.xl,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: s.md,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: s.sm,
  },
  cta: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: s.xl,
  },
  buttons: {
    width: '100%',
    gap: s.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s.md,
    paddingHorizontal: s.lg,
    borderRadius: r.md,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: s.md,
    paddingHorizontal: s.lg,
    borderRadius: r.md,
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
