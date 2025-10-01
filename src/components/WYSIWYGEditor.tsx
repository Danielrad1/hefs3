/**
 * WYSIWYGEditor - True WYSIWYG rich text editor
 * Uses react-native-pell-rich-editor for Word-like editing experience
 */

import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, StyleSheet, ScrollView, Platform, Text as RNText } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';

interface WYSIWYGEditorProps {
  value: string;
  onChangeText: (html: string) => void;
  placeholder?: string;
  onInsertImage?: () => void;
  onInsertAudio?: () => void;
  onInsertCloze?: () => void;
  multiline?: boolean;
}

export interface WYSIWYGEditorRef {
  insertImage: (filename: string) => void;
  insertAudio: (filename: string) => void;
  insertCloze: () => void;
  insertHTML: (html: string) => void;
}

const WYSIWYGEditor = forwardRef<WYSIWYGEditorRef, WYSIWYGEditorProps>(
  (
    {
      value,
      onChangeText,
      placeholder = 'Enter text...',
      onInsertImage,
      onInsertAudio,
      onInsertCloze,
      multiline = true,
    },
    ref
  ) => {
    const theme = useTheme();
    const richText = useRef<RichEditor>(null);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      insertImage: (filename: string) => {
        console.log('[WYSIWYGEditor] insertImage called with:', filename);
        richText.current?.insertHTML(`<img src="${filename}" style="max-width: 100%; height: auto;" />`);
      },
      insertAudio: (filename: string) => {
        console.log('[WYSIWYGEditor] insertAudio called with:', filename);
        richText.current?.insertHTML(`[sound:${filename}]`);
      },
      insertCloze: () => {
        console.log('[WYSIWYGEditor] insertCloze called');
        richText.current?.insertHTML('{{c1::text}}');
      },
      insertHTML: (html: string) => {
        console.log('[WYSIWYGEditor] insertHTML called with:', html);
        richText.current?.insertHTML(html);
      },
    }));

    // Custom actions for our toolbar
    const customActions = [];
    
    if (onInsertImage) {
      customActions.push('insertImage');
    }
    
    if (onInsertAudio) {
      customActions.push('insertAudio');
    }
    
    if (onInsertCloze) {
      customActions.push('insertCloze');
    }

    const toolbarActions = [
      actions.setBold,
      actions.setItalic,
      actions.setUnderline,
      actions.insertBulletsList,
      actions.insertOrderedList,
      actions.setStrikethrough,
      actions.code,
      ...customActions,
      actions.undo,
      actions.redo,
    ];

    return (
      <View style={styles.container}>
        <RichToolbar
          editor={richText}
          actions={toolbarActions}
          iconMap={{
            insertImage: ({ tintColor }: any) => (
              <Ionicons name="image-outline" size={20} color={tintColor} />
            ),
            insertAudio: ({ tintColor }: any) => (
              <Ionicons name="musical-notes-outline" size={20} color={tintColor} />
            ),
            insertCloze: ({ tintColor }: any) => (
              <Ionicons name="ellipsis-horizontal-circle-outline" size={20} color={tintColor} />
            ),
            [actions.setBold]: ({ tintColor }: any) => (
              <RNText style={{ fontSize: 18, fontWeight: 'bold', color: tintColor }}>B</RNText>
            ),
            [actions.setItalic]: ({ tintColor }: any) => (
              <RNText style={{ fontSize: 18, fontStyle: 'italic', color: tintColor }}>I</RNText>
            ),
            [actions.setUnderline]: ({ tintColor }: any) => (
              <RNText style={{ fontSize: 18, textDecorationLine: 'underline', color: tintColor }}>U</RNText>
            ),
            [actions.insertBulletsList]: ({ tintColor }: any) => (
              <Ionicons name="list" size={20} color={tintColor} />
            ),
            [actions.insertOrderedList]: ({ tintColor }: any) => (
              <Ionicons name="list-outline" size={20} color={tintColor} />
            ),
            [actions.setStrikethrough]: ({ tintColor }: any) => (
              <RNText style={{ fontSize: 18, textDecorationLine: 'line-through', color: tintColor }}>S</RNText>
            ),
            [actions.code]: ({ tintColor }: any) => (
              <Ionicons name="code-slash-outline" size={20} color={tintColor} />
            ),
            [actions.undo]: ({ tintColor }: any) => (
              <Ionicons name="arrow-undo" size={20} color={tintColor} />
            ),
            [actions.redo]: ({ tintColor }: any) => (
              <Ionicons name="arrow-redo" size={20} color={tintColor} />
            ),
          }}
          onPressAddImage={onInsertImage}
          insertImage={onInsertImage}
          insertAudio={onInsertAudio}
          insertCloze={onInsertCloze}
          style={[styles.toolbar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
          selectedIconTint={theme.colors.accent}
          iconTint={theme.colors.textSecondary}
          disabledIconTint={theme.colors.border}
        />
        <ScrollView 
          style={[styles.editorContainer, { backgroundColor: theme.colors.bg }]}
          keyboardDismissMode="none"
          nestedScrollEnabled
        >
          <RichEditor
            ref={richText}
            initialContentHTML={value}
            onChange={onChangeText}
            placeholder={placeholder}
            style={[styles.editor, { backgroundColor: theme.colors.bg, minHeight: multiline ? 200 : 60 }]}
            editorStyle={{
              backgroundColor: theme.colors.bg,
              color: theme.colors.textPrimary,
              placeholderColor: theme.colors.textSecondary,
              contentCSSText: `
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 18px;
                line-height: 1.6;
                padding: 16px;
                min-height: ${multiline ? '200px' : '60px'};
              `,
            }}
            initialHeight={multiline ? 200 : 60}
          />
        </ScrollView>
      </View>
    );
  }
);

WYSIWYGEditor.displayName = 'WYSIWYGEditor';

const styles = StyleSheet.create({
  container: {
    borderRadius: r.lg,
    overflow: 'hidden',
  },
  toolbar: {
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: r.lg,
    borderTopRightRadius: r.lg,
    minHeight: 50,
    paddingHorizontal: s.xs,
  },
  editorContainer: {
    borderWidth: 1,
    borderBottomLeftRadius: r.lg,
    borderBottomRightRadius: r.lg,
    minHeight: 200,
  },
  editor: {
    flex: 1,
  },
});

export default WYSIWYGEditor;
