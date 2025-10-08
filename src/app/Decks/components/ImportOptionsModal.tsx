import React from 'react';
import { View, Text, Modal, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface ImportOptionsModalProps {
  visible: boolean;
  deckName: string;
  hasProgress: boolean;
  progressStats?: {
    reviewedCards: number;
    totalCards: number;
  };
  onImportWithProgress: () => void;
  onImportFresh: () => void;
  onCancel: () => void;
}

export default function ImportOptionsModal({
  visible,
  deckName,
  hasProgress,
  progressStats,
  onImportWithProgress,
  onImportFresh,
  onCancel,
}: ImportOptionsModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Ionicons name="download" size={32} color={theme.colors.accent} />
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Import Options
            </Text>
            <Text style={[styles.deckName, { color: theme.colors.textSecondary }]}>
              {deckName}
            </Text>
          </View>

          {/* Progress Info */}
          {hasProgress && progressStats && (
            <View style={[styles.progressInfo, { backgroundColor: theme.colors.bg }]}>
              <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
              <Text style={[styles.progressText, { color: theme.colors.textPrimary }]}>
                This deck contains progress data
              </Text>
              <Text style={[styles.progressDetail, { color: theme.colors.textSecondary }]}>
                {progressStats.reviewedCards} of {progressStats.totalCards} cards have been reviewed
              </Text>
            </View>
          )}

          {/* Options */}
          <View style={styles.options}>
            {hasProgress && (
              <Pressable
                style={[styles.option, { backgroundColor: theme.colors.accent }]}
                onPress={onImportWithProgress}
              >
                <View style={styles.optionIcon}>
                  <Ionicons name="trending-up" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.optionContent}>
                  <Text style={styles.optionTitle}>
                    Keep Progress
                  </Text>
                  <Text style={styles.optionDescription}>
                    Import with review history and scheduling data
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
              </Pressable>
            )}

            <Pressable
              style={[styles.option, { backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border }]}
              onPress={onImportFresh}
            >
              <View style={styles.optionIcon}>
                <Ionicons name="refresh" size={24} color={theme.colors.textPrimary} />
              </View>
              <View style={styles.optionContent}>
                <Text style={[styles.optionTitle, { color: theme.colors.textPrimary }]}>
                  Start Fresh
                </Text>
                <Text style={[styles.optionDescription, { color: theme.colors.textSecondary }]}>
                  Import as new deck, discard progress
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Cancel Button */}
          <Pressable
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <Text style={[styles.cancelText, { color: theme.colors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
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
  modal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: r.xl,
    padding: s.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: s.sm,
    marginBottom: s.xs,
  },
  deckName: {
    fontSize: 14,
    textAlign: 'center',
  },
  progressInfo: {
    padding: s.md,
    borderRadius: r.md,
    marginBottom: s.lg,
    alignItems: 'center',
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: s.xs,
  },
  progressDetail: {
    fontSize: 12,
    marginTop: s.xs / 2,
  },
  options: {
    gap: s.md,
    marginBottom: s.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.lg,
    borderRadius: r.md,
    gap: s.md,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: r.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: s.xs / 2,
  },
  optionDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  cancelButton: {
    padding: s.md,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
