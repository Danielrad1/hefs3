import React from 'react';
import { View, Text, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface ImportProgressModalProps {
  visible: boolean;
  progress: string;
}

export default function ImportProgressModal({ visible, progress }: ImportProgressModalProps) {
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
    gap: s.lg,
    alignItems: 'center',
    minWidth: 200,
  },
  progressText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
