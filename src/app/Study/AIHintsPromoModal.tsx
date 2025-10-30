import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { logger } from '../../utils/logger';

interface AIHintsPromoModalProps {
  visible: boolean;
  onClose: () => void;
  onEnable: () => void;
}

export default function AIHintsPromoModal({ visible, onClose, onEnable }: AIHintsPromoModalProps) {
  const theme = useTheme();

  React.useEffect(() => {
    if (visible) {
      logger.info('[AIHintsPromoModal] Modal is now visible');
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <View style={[styles.modal, { backgroundColor: theme.colors.bg }]}>
          {/* Close Button */}
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </Pressable>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Hero Icon */}
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Ionicons name="bulb" size={56} color="#8B5CF6" />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Stop Wasting Time
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Learn faster using hints
            </Text>

            {/* Benefits */}
            <View style={styles.benefits}>
              <View style={[styles.benefitCard, { backgroundColor: 'rgba(236, 72, 153, 0.1)' }]}>
                <View style={styles.benefitHeader}>
                  <Ionicons name="flash" size={24} color="#EC4899" />
                  <Text style={[styles.benefitPercent, { color: '#EC4899' }]}>Faster Learning</Text>
                </View>
                <Text style={[styles.benefitText, { color: theme.colors.textPrimary }]}>
                  Learn the same material with less grind
                </Text>
              </View>

              <View style={[styles.benefitCard, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                <View style={styles.benefitHeader}>
                  <Ionicons name="time" size={24} color="#8B5CF6" />
                  <Text style={[styles.benefitPercent, { color: '#8B5CF6' }]}>Less Time Reviewing</Text>
                </View>
                <Text style={[styles.benefitText, { color: theme.colors.textPrimary }]}>
                  Cut revision time while scoring just as high
                </Text>
              </View>

              <View style={[styles.benefitCard, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <View style={styles.benefitHeader}>
                  <Ionicons name="trophy" size={24} color="#10B981" />
                  <Text style={[styles.benefitPercent, { color: '#10B981' }]}>Stronger Retention</Text>
                </View>
                <Text style={[styles.benefitText, { color: theme.colors.textPrimary }]}>
                  Remember weeks later what others forgot
                </Text>
              </View>
            </View>

            {/* How It Works */}
            <View style={[styles.howItWorks, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.howTitle, { color: theme.colors.textPrimary }]}>
                How It Works
              </Text>
              
              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: theme.colors.accent }]}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.colors.textPrimary }]}>
                  AI analyzes every card and creates smart hints
                </Text>
              </View>

              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: theme.colors.accent }]}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.colors.textPrimary }]}>
                  Get 3 levels of progressive clues when stuck
                </Text>
              </View>

              <View style={styles.step}>
                <View style={[styles.stepNumber, { backgroundColor: theme.colors.accent }]}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={[styles.stepText, { color: theme.colors.textPrimary }]}>
                  Memory techniques help facts stick
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* CTA Buttons */}
          <View style={[styles.footer, { backgroundColor: theme.colors.bg }]}>
            <Pressable
              style={[styles.enableButton, { backgroundColor: theme.colors.accent }]}
              onPress={() => {
                logger.info('[AIHintsPromoModal] Enable button pressed');
                onEnable();
              }}
            >
              <Ionicons name="sparkles" size={20} color="#000" style={{ marginRight: s.sm }} />
              <Text style={styles.enableButtonText}>Enable AI Hints</Text>
            </Pressable>
            
            <Pressable style={styles.notNowButton} onPress={onClose}>
              <Text style={[styles.notNowText, { color: theme.colors.textSecondary }]}>
                Not Now
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.lg,
  },
  modal: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: r.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: s.md,
    right: s.md,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexShrink: 1,
  },
  contentContainer: {
    padding: s.xl,
    paddingTop: s.xl + 20,
    paddingBottom: s.lg,
  },
  heroIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: s.sm,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: s.xl,
  },
  benefits: {
    gap: s.md,
    marginBottom: s.xl,
  },
  benefitCard: {
    padding: s.lg,
    borderRadius: r.lg,
  },
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    marginBottom: s.sm,
  },
  benefitPercent: {
    fontSize: 18,
    fontWeight: '800',
  },
  benefitText: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '500',
  },
  howItWorks: {
    padding: s.xl,
    borderRadius: r.lg,
  },
  howTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: s.lg,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s.md,
    marginBottom: s.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    paddingTop: 3,
  },
  footer: {
    paddingHorizontal: s.xl,
    paddingTop: s.lg,
    paddingBottom: s.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  enableButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  enableButtonText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
  },
  notNowButton: {
    padding: s.md,
    alignItems: 'center',
  },
  notNowText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
