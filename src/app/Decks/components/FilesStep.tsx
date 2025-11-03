import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import { FileAttachment } from '../../../services/ai/promptBuilders';
import FileChip from './FileChip';

interface FilesStepProps {
  attachments: FileAttachment[];
  isParsingFile: boolean;
  onAddFile: () => void;
  onRemoveFile: (fileId: string) => void;
  onMoveFile: (fileId: string, direction: 'up' | 'down') => void;
  showCharacterWarning: boolean;
  totalChars: number;
}

export default function FilesStep({
  attachments,
  isParsingFile,
  onAddFile,
  onRemoveFile,
  onMoveFile,
  showCharacterWarning,
  totalChars,
}: FilesStepProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.inputHeader}>
        <Text style={[styles.inputLabel, { color: theme.colors.textPrimary }]}>Import Files</Text>
        <Text style={[styles.inputHint, { color: theme.colors.textSecondary }]}>
          Add one or more files to generate cards from their content
        </Text>
      </View>

      <Pressable
        style={[
          styles.addFileButton,
          { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 },
        ]}
        onPress={onAddFile}
        disabled={isParsingFile}
      >
        <View style={[styles.addFileIcon, { backgroundColor: theme.colors.overlay.primary }]}>
          {isParsingFile ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Ionicons name="add" size={24} color={theme.colors.primary} />
          )}
        </View>
        <View style={styles.addFileContent}>
          <Text style={[styles.addFileText, { color: theme.colors.textHigh }]}>
            {isParsingFile ? 'Parsing file...' : 'Add File'}
          </Text>
          <Text style={[styles.addFileHint, { color: theme.colors.textMed }]}>
            .txt, .docx, .pdf
          </Text>
        </View>
      </Pressable>

      {attachments.length > 0 && (
        <View style={styles.fileChipsContainer}>
          {attachments.map((file, index) => (
            <FileChip
              key={file.id}
              file={file}
              index={index}
              totalFiles={attachments.length}
              onMoveUp={() => onMoveFile(file.id, 'up')}
              onMoveDown={() => onMoveFile(file.id, 'down')}
              onRemove={() => onRemoveFile(file.id)}
            />
          ))}
        </View>
      )}

      {showCharacterWarning && (
        <View
          style={[
            styles.warningBanner,
            { backgroundColor: theme.colors.warning + '20', borderColor: theme.colors.warning },
          ]}
        >
          <Ionicons name="warning" size={20} color={theme.colors.warning} />
          <Text style={[styles.warningText, { color: theme.colors.warning }]}>
            Content is very large ({Math.round(totalChars / 1000)}k chars). Consider splitting into
            multiple generations.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: s.lg,
    gap: s.md,
  },
  inputHeader: {
    gap: s.xs / 2,
  },
  inputLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputHint: {
    fontSize: 14,
    lineHeight: 20,
  },
  addFileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.lg,
    borderRadius: r.lg,
    borderWidth: 2,
    gap: s.md,
  },
  addFileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addFileContent: {
    flex: 1,
    gap: s.xs / 2,
  },
  addFileText: {
    fontSize: 16,
    fontWeight: '700',
  },
  addFileHint: {
    fontSize: 13,
  },
  fileChipsContainer: {
    gap: s.sm,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    gap: s.sm,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
