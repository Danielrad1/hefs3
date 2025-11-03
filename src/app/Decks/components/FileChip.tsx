import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import { FileAttachment, getFileIconName, formatFileSize } from '../../../services/ai/promptBuilders';

interface FileChipProps {
  file: FileAttachment;
  index: number;
  totalFiles: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

export default function FileChip({
  file,
  index,
  totalFiles,
  onMoveUp,
  onMoveDown,
  onRemove,
}: FileChipProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.fileChip,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Ionicons
        name={getFileIconName(file.mimeType, file.name)}
        size={20}
        color={theme.colors.primary}
      />
      <View style={styles.fileInfo}>
        <Text style={[styles.fileChipName, { color: theme.colors.textHigh }]} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={[styles.fileChipSize, { color: theme.colors.textMed }]}>
          {formatFileSize(file.size)}
          {!file.parsedText && ' • Parsing...'}
        </Text>
      </View>
      <View style={styles.fileChipActions}>
        {index > 0 && (
          <Pressable onPress={onMoveUp} hitSlop={8}>
            <Ionicons name="arrow-up" size={18} color={theme.colors.textMed} />
          </Pressable>
        )}
        {index < totalFiles - 1 && (
          <Pressable onPress={onMoveDown} hitSlop={8}>
            <Ionicons name="arrow-down" size={18} color={theme.colors.textMed} />
          </Pressable>
        )}
        <Pressable onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={theme.colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.md,
    borderRadius: r.lg,
    borderWidth: 1,
    gap: s.sm,
  },
  fileInfo: {
    flex: 1,
  },
  fileChipName: {
    fontSize: 15,
    fontWeight: '600',
  },
  fileChipSize: {
    fontSize: 13,
    marginTop: 2,
  },
  fileChipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
});
