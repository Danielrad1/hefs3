/**
 * WYSIWYGEditor - True WYSIWYG rich text editor
 * Uses react-native-pell-rich-editor for Word-like editing experience
 */

import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Platform, Text as RNText } from 'react-native';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';
import { MEDIA_DIR } from '../services/anki/MediaService';

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
    const lastValueRef = useRef(value);

    // Process HTML to convert filenames to base64 for display
    const [processedValue, setProcessedValue] = useState(value);
    const [isProcessing, setIsProcessing] = useState(false);
    
    useEffect(() => {
      if (!value) {
        setProcessedValue(value);
        setIsProcessing(false);
        return;
      }
      
      // Already processed
      if (value.includes('data:image')) {
        setProcessedValue(value);
        setIsProcessing(false);
        return;
      }
      
      // Check if there are images to convert
      const hasImages = /<img\s+([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi.test(value);
      if (!hasImages) {
        setProcessedValue(value);
        setIsProcessing(false);
        return;
      }
      
      // Convert image filenames to base64 asynchronously
      setIsProcessing(true);
      const convertImagesToBase64 = async () => {
        let processed = value;
        const imgRegex = /<img\s+([^>]*?)src\s*=\s*["']([^"']+)["']([^>]*?)>/gi;
        const matches = Array.from(value.matchAll(imgRegex));
        
        for (const match of matches) {
          const [fullMatch, before, src, after] = match;
          
          // Skip if already a full path or base64
          if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
            continue;
          }
          
          try {
            // Sanitize and encode filename like CardContentRendererV2 does
            const sanitized = src.replace(/[^A-Za-z0-9._-]/g, '_');
            const encodedFilename = encodeURIComponent(sanitized);
            const fullPath = `${MEDIA_DIR}${encodedFilename}`;
            
            // Check if file exists and convert to base64
            const fileInfo = await FileSystem.getInfoAsync(fullPath);
            if (fileInfo.exists) {
              const base64 = await FileSystem.readAsStringAsync(fullPath, {
                encoding: FileSystem.EncodingType.Base64,
              });
              
              // Determine MIME type from extension
              const ext = sanitized.split('.').pop()?.toLowerCase() || 'png';
              const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                              ext === 'png' ? 'image/png' : 
                              ext === 'gif' ? 'image/gif' : 
                              ext === 'svg' ? 'image/svg+xml' : 'image/png';
              
              const base64Src = `data:${mimeType};base64,${base64}`;
              processed = processed.replace(fullMatch, `<img ${before}src="${base64Src}"${after}>`);
            }
          } catch (error) {
            console.warn('[WYSIWYGEditor] Failed to convert image:', src, error);
          }
        }
        
        setProcessedValue(processed);
        setIsProcessing(false);
      };
      
      convertImagesToBase64();
    }, [value]);

    // Force content update when processed value changes
    useEffect(() => {
      if (!isProcessing && processedValue && richText.current) {
        // Small delay to ensure WebView is ready
        setTimeout(() => {
          richText.current?.setContentHTML(processedValue);
        }, 100);
      }
    }, [processedValue, isProcessing]);

    // Expose methods to parent via ref
    useImperativeHandle(ref, () => ({
      insertImage: async (filename: string) => {
        try {
          // Convert image to base64 for WebView compatibility
          const fullPath = `${MEDIA_DIR}${filename}`;
          const base64 = await FileSystem.readAsStringAsync(fullPath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          
          // Determine image type from extension
          const ext = filename.split('.').pop()?.toLowerCase();
          let mimeType = 'image/jpeg';
          if (ext === 'png') mimeType = 'image/png';
          else if (ext === 'gif') mimeType = 'image/gif';
          else if (ext === 'webp') mimeType = 'image/webp';
          
          const dataUri = `data:${mimeType};base64,${base64}`;
          richText.current?.insertHTML(`<img src="${dataUri}" data-filename="${filename}" style="max-width:100%;height:auto;display:block;margin:8px auto;" />`);
        } catch (error) {
          console.error('[WYSIWYGEditor] Error converting image to base64:', error);
        }
      },
      insertAudio: (filename: string) => {
        richText.current?.insertHTML(`[sound:${filename}]`);
      },
      insertCloze: () => {
        richText.current?.insertHTML('{{c1::text}}');
      },
      insertHTML: (html: string) => {
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
      actions.setSubscript,
      actions.setSuperscript,
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
            [actions.setSubscript]: ({ tintColor }: any) => (
              <RNText style={{ fontSize: 16, color: tintColor }}>X₂</RNText>
            ),
            [actions.setSuperscript]: ({ tintColor }: any) => (
              <RNText style={{ fontSize: 16, color: tintColor }}>X²</RNText>
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
        {isProcessing ? (
          <View style={[styles.editor, { backgroundColor: theme.colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
            <RNText style={{ color: theme.colors.textSecondary }}>Loading images...</RNText>
          </View>
        ) : (
          <RichEditor
            ref={richText}
            initialContentHTML={processedValue || ''}
            onChange={onChangeText}
            placeholder={placeholder}
            style={[styles.editor, { backgroundColor: theme.colors.bg }]}
          editorStyle={{
            backgroundColor: theme.colors.bg,
            color: theme.colors.textPrimary,
            placeholderColor: theme.colors.textSecondary,
            contentCSSText: `
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 18px;
              line-height: 1.6;
              padding: 16px;
              min-height: ${multiline ? '250px' : '80px'};
            `,
            cssText: `
              * {
                box-sizing: border-box !important;
              }
              img {
                max-width: 100% !important;
                width: auto !important;
                height: auto !important;
                display: block !important;
                margin: 12px auto !important;
                object-fit: contain !important;
              }
              p {
                margin: 8px 0 !important;
                min-height: 1.6em !important;
              }
              div {
                min-height: auto !important;
              }
              body {
                overflow-y: auto !important;
                word-wrap: break-word !important;
              }
            `,
          }}
          initialHeight={multiline ? 250 : 80}
          useContainer={true}
          pasteAsPlainText={false}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
        />
        )}
      </View>
    );
  }
);

WYSIWYGEditor.displayName = 'WYSIWYGEditor';

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  toolbar: {
    minHeight: 50,
    paddingHorizontal: s.xs,
  },
  editor: {
    height: 250,
  },
});

export default WYSIWYGEditor;
