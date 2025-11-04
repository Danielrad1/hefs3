import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
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

          <View style={styles.content}>
            {/* Hero Icon */}
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(139, 92, 246, 0.15)' }]}>
              <Ionicons name="bulb" size={48} color="#8B5CF6" />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              AI Hints Not Enabled
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              You haven't enabled AI hints for this deck yet. Would you like to enable them now?
            </Text>
          </View>

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
    maxWidth: 400,
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
    padding: s.xl,
    paddingTop: s.xl + 20,
    paddingBottom: s.lg,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: s.md,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
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
