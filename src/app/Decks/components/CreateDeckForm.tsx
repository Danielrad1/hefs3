import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface CreateDeckFormProps {
  value: string;
  onChangeText: (text: string) => void;
  onCancel: () => void;
  onCreate: () => void;
}

export default function CreateDeckForm({
  value,
  onChangeText,
  onCancel,
  onCreate,
}: CreateDeckFormProps) {
  const theme = useTheme();

  return (
    <View style={[styles.createDeckCard, { backgroundColor: theme.colors.surface }]}>
      <TextInput
        style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
        placeholder="Enter deck name (e.g., Parent::Child)"
        placeholderTextColor={theme.colors.textSecondary}
        value={value}
        onChangeText={onChangeText}
        autoFocus
      />
      <View style={styles.createActions}>
        <Pressable
          style={[styles.createButton, { backgroundColor: theme.colors.surface }]}
          onPress={onCancel}
        >
          <Text style={[styles.createButtonText, { color: theme.colors.textSecondary }]}>
            Cancel
          </Text>
        </Pressable>
        <Pressable
          style={[styles.createButton, { backgroundColor: theme.colors.accent }]}
          onPress={onCreate}
        >
          <Text style={[styles.createButtonText, { color: '#000' }]}>
            Create
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  createDeckCard: {
    padding: s.md,
    borderRadius: r.md,
    marginBottom: s.md,
    gap: s.md,
  },
  input: {
    padding: s.md,
    borderRadius: r.sm,
    borderWidth: 1,
    fontSize: 16,
  },
  createActions: {
    flexDirection: 'row',
    gap: s.sm,
    justifyContent: 'flex-end',
  },
  createButton: {
    paddingVertical: s.sm,
    paddingHorizontal: s.lg,
    borderRadius: r.sm,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
