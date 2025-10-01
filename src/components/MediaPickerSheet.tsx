/**
 * MediaPickerSheet - Bottom sheet for media insertion
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../design/theme';
import { s } from '../design/spacing';
import { r } from '../design/radii';

export type MediaType = 'image' | 'audio';

export interface MediaPickerSheetProps {
  visible: boolean;
  type: MediaType;
  onMediaSelected: (uri: string, filename: string) => void;
  onClose: () => void;
}

export default function MediaPickerSheet({
  visible,
  type,
  onMediaSelected,
  onClose,
}: MediaPickerSheetProps) {
  const theme = useTheme();

  const handleCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || `photo-${Date.now()}.jpg`;
        onMediaSelected(uri, filename);
        onClose();
      }
    } catch (error) {
      console.error('[MediaPickerSheet] Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const handleLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          type === 'image'
            ? ImagePicker.MediaTypeOptions.Images
            : ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: type === 'image',
      });

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        const filename = uri.split('/').pop() || `media-${Date.now()}`;
        onMediaSelected(uri, filename);
        onClose();
      }
    } catch (error) {
      console.error('[MediaPickerSheet] Library error:', error);
      Alert.alert('Error', 'Failed to pick media');
    }
  };

  const actions = type === 'image'
    ? [
        { id: 'camera', label: 'Take Photo', icon: '📷', onPress: handleCamera },
        { id: 'library', label: 'Choose from Library', icon: '🖼️', onPress: handleLibrary },
      ]
    : [
        { id: 'library', label: 'Choose Audio File', icon: '🎵', onPress: handleLibrary },
        // Audio recording could be added here with expo-av
      ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.colors.surface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {type === 'image' ? 'Add Image' : 'Add Audio'}
            </Text>
          </View>

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.id}
                style={[styles.action, { borderBottomColor: theme.colors.border }]}
                onPress={action.onPress}
              >
                <Text style={styles.icon}>{action.icon}</Text>
                <Text style={[styles.actionLabel, { color: theme.colors.textPrimary }]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={[styles.cancelButton, { backgroundColor: theme.colors.bg }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelLabel, { color: theme.colors.textPrimary }]}>Cancel</Text>
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
    fontSize: 24,
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
