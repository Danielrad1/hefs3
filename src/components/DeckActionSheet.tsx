/**
 * DeckActionSheet - Bottom sheet with deck actions
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';

export interface DeckAction {
  id: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface DeckActionSheetProps {
  visible: boolean;
  deckName: string;
  actions: DeckAction[];
  onClose: () => void;
}

export default function DeckActionSheet({
  visible,
  deckName,
  actions,
  onClose,
}: DeckActionSheetProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {deckName}
            </Text>
          </View>

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.id}
                style={[
                  styles.action,
                  { borderBottomColor: theme.colors.border },
                ]}
                onPress={() => {
                  action.onPress();
                  onClose();
                }}
              >
                {action.icon && (
                  <Text style={styles.icon}>{action.icon}</Text>
                )}
                <Text
                  style={[
                    styles.actionLabel,
                    {
                      color: action.destructive
                        ? theme.colors.danger
                        : theme.colors.textPrimary,
                    },
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[
              styles.cancelButton,
              { backgroundColor: theme.colors.surface },
            ]}
            onPress={onClose}
          >
            <Text style={[styles.cancelLabel, { color: theme.colors.textPrimary }]}>
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: r.lg,
    borderTopRightRadius: r.lg,
    paddingBottom: s.xl,
  },
  header: {
    padding: s.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  actions: {
    paddingTop: s.sm,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.lg,
    gap: s.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    fontSize: 20,
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButton: {
    margin: s.md,
    padding: s.lg,
    borderRadius: r.md,
    alignItems: 'center',
  },
  cancelLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});
