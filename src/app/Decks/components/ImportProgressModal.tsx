import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator, Pressable } from 'react-native';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface ImportProgressModalProps {
  visible: boolean;
  progress: string;
  timeEstimate?: string;
  onCancel?: () => void;
}

export default function ImportProgressModal({ visible, progress, timeEstimate, onCancel }: ImportProgressModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.progressModal, { backgroundColor: theme.colors.surface }]}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
          <Text style={[styles.progressText, { color: theme.colors.textPrimary }]}>
            {progress}
          </Text>
          {timeEstimate && (
            <Text style={[styles.timeEstimate, { color: theme.colors.textSecondary }]}>
              {timeEstimate}
            </Text>
          )}
          {onCancel && (
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.cancelButton,
                { 
                  backgroundColor: theme.colors.danger,
                  opacity: pressed ? 0.7 : 1 
                }
              ]}
            >
              <Text style={[styles.cancelText, { color: '#FFFFFF' }]}>
                Cancel Import
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.lg,
  },
  progressModal: {
    borderRadius: r.lg,
    padding: s.xl,
    gap: s.md,
    alignItems: 'center',
    minWidth: 250,
    maxWidth: 320,
  },
  progressText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  timeEstimate: {
    fontSize: 14,
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: s.sm,
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderRadius: r.md,
    minWidth: 140,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
