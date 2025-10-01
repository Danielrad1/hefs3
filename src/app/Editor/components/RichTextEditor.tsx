/**
 * RichTextEditor - HTML editor with formatting toolbar
 * Simple implementation for Expo managed workflow
 */

import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text, ScrollView } from 'react-native';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface RichTextEditorProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onInsertImage?: () => void;
  onInsertAudio?: () => void;
  onInsertCloze?: () => void;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  multiline?: boolean;
  style?: any;
}

interface ToolbarButton {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
}

export default function RichTextEditor({
  value,
  onChangeText,
  placeholder = 'Enter text...',
  onInsertImage,
  onInsertAudio,
  onInsertCloze,
  onSelectionChange,
  multiline = true,
  style,
}: RichTextEditorProps) {
  const theme = useTheme();
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const inputRef = React.useRef<TextInput>(null);

  const handleSelectionChange = (e: any) => {
    const newSelection = e.nativeEvent.selection;
    setSelection(newSelection);
    onSelectionChange?.(newSelection);
  };

  const wrapSelection = (before: string, after: string) => {
    const { start, end } = selection;
    const selectedText = value.substring(start, end);
    
    if (selectedText) {
      // Wrap selected text
      const newText =
        value.substring(0, start) +
        before +
        selectedText +
        after +
        value.substring(end);
      onChangeText(newText);
      
      // Update selection to be after the wrapped text
      setTimeout(() => {
        inputRef.current?.setNativeProps({
          selection: { start: start + before.length + selectedText.length + after.length, end: start + before.length + selectedText.length + after.length },
        });
      }, 0);
    } else {
      // Insert placeholder if no selection
      const placeholder = before + 'text' + after;
      const newText = value.substring(0, start) + placeholder + value.substring(end);
      onChangeText(newText);
      
      // Select the placeholder text
      setTimeout(() => {
        inputRef.current?.setNativeProps({
          selection: { start: start + before.length, end: start + before.length + 4 },
        });
      }, 0);
    }
  };

  const toolbarButtons: ToolbarButton[] = [
    {
      id: 'bold',
      label: 'B',
      icon: '𝐁',
      onPress: () => wrapSelection('<b>', '</b>'),
    },
    {
      id: 'italic',
      label: 'I',
      icon: '𝐼',
      onPress: () => wrapSelection('<i>', '</i>'),
    },
    {
      id: 'underline',
      label: 'U',
      icon: 'U̲',
      onPress: () => wrapSelection('<u>', '</u>'),
    },
    {
      id: 'highlight',
      label: 'H',
      icon: '🖍',
      onPress: () => wrapSelection('<mark>', '</mark>'),
    },
    {
      id: 'code',
      label: '<>',
      icon: '</>',
      onPress: () => wrapSelection('<code>', '</code>'),
    },
  ];

  // Add media buttons if handlers provided
  const mediaButtons: ToolbarButton[] = [];
  
  if (onInsertImage) {
    mediaButtons.push({
      id: 'image',
      label: '🖼',
      icon: '🖼',
      onPress: onInsertImage,
    });
  }
  
  if (onInsertAudio) {
    mediaButtons.push({
      id: 'audio',
      label: '🎵',
      icon: '🎵',
      onPress: onInsertAudio,
    });
  }
  
  if (onInsertCloze) {
    mediaButtons.push({
      id: 'cloze',
      label: '[...]',
      icon: '[...]',
      onPress: onInsertCloze,
    });
  }

  return (
    <View style={[styles.container, style]}>
      {/* Toolbar */}
      <ScrollView
        horizontal
        style={[styles.toolbar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
        contentContainerStyle={styles.toolbarContent}
        showsHorizontalScrollIndicator={false}
      >
        {toolbarButtons.map((button) => (
          <Pressable
            key={button.id}
            style={[styles.toolbarButton, { backgroundColor: theme.colors.bg }]}
            onPress={button.onPress}
          >
            <Text style={[styles.toolbarButtonText, { color: theme.colors.textPrimary }]}>
              {button.icon}
            </Text>
          </Pressable>
        ))}
        
        {mediaButtons.length > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            {mediaButtons.map((button) => (
              <Pressable
                key={button.id}
                style={[styles.toolbarButton, { backgroundColor: theme.colors.bg }]}
                onPress={button.onPress}
              >
                <Text style={[styles.toolbarButtonText, { color: theme.colors.textPrimary }]}>
                  {button.icon}
                </Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>

      {/* Text Input */}
      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.bg,
            color: theme.colors.textPrimary,
            borderColor: theme.colors.border,
          },
          multiline && styles.multilineInput,
        ]}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={handleSelectionChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSecondary}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: s.sm,
  },
  toolbar: {
    maxHeight: 50,
    borderRadius: r.md,
    borderWidth: 1,
  },
  toolbarContent: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs,
    gap: s.xs,
    alignItems: 'center',
  },
  toolbarButton: {
    width: 36,
    height: 36,
    borderRadius: r.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    height: 30,
    marginHorizontal: s.xs,
  },
  input: {
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 120,
  },
});
