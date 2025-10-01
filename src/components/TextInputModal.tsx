/**
 * TextInputModal - Cross-platform text input modal (Android-compatible replacement for Alert.prompt)
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';

interface TextInputModalProps {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function TextInputModal({
  visible,
  title,
  message,
  placeholder,
  defaultValue = '',
  onConfirm,
  onCancel,
  confirmText = 'OK',
  cancelText = 'Cancel',
}: TextInputModalProps) {
  const theme = useTheme();
  const [text, setText] = useState(defaultValue);

  // Reset text when modal becomes visible
  useEffect(() => {
    if (visible) {
      setText(defaultValue);
    }
  }, [visible, defaultValue]);

  const handleConfirm = () => {
    onConfirm(text);
    setText('');
  };

  const handleCancel = () => {
    onCancel();
    setText('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable style={[styles.modal, { backgroundColor: theme.colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
          {message && (
            <Text style={[styles.message, { color: theme.colors.textSecondary }]}>{message}</Text>
          )}
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.colors.bg,
                color: theme.colors.textPrimary,
                borderColor: theme.colors.border,
              },
            ]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            autoFocus
            onSubmitEditing={handleConfirm}
          />
          <View style={styles.buttons}>
            <Pressable
              style={[styles.button, { backgroundColor: theme.colors.bg }]}
              onPress={handleCancel}
            >
              <Text style={[styles.buttonText, { color: theme.colors.textPrimary }]}>
                {cancelText}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: theme.colors.accent }]}
              onPress={handleConfirm}
            >
              <Text style={[styles.buttonText, { color: '#000' }]}>{confirmText}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '85%',
    maxWidth: 400,
    borderRadius: r.lg,
    padding: s.xl,
    gap: s.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    fontSize: 16,
  },
  buttons: {
    flexDirection: 'row',
    gap: s.md,
  },
  button: {
    flex: 1,
    padding: s.md,
    borderRadius: r.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
