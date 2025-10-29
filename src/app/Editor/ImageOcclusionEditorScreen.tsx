import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Image,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { NoteService } from '../../services/anki/NoteService';
import { MediaService } from '../../services/anki/MediaService';
import { logger } from '../../utils/logger';

interface Mask {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

type OcclusionMode = 'hide-one' | 'hide-all';

interface ImageOcclusionEditorScreenProps {
  route: {
    params: {
      deckId: string;
    };
  };
  navigation: any;
}

export default function ImageOcclusionEditorScreen({ route, navigation }: ImageOcclusionEditorScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { deckId } = route.params;

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string | null>(null);
  const [masks, setMasks] = useState<Mask[]>([]);
  const [mode, setMode] = useState<OcclusionMode>('hide-one');
  const [extraText, setExtraText] = useState('');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);

  const noteService = new NoteService(db);
  const mediaService = new MediaService(db);

  // Pick image from library
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);

      Image.getSize(
        asset.uri,
        (w, h) => {
          setImageDimensions({ width: w, height: h });
        },
        (error) => {
          logger.error('[ImageOcclusionEditor] Failed to get image size:', error);
        }
      );

      try {
        const media = await mediaService.addMediaFile(asset.uri);
        setImageFilename(media.filename);
      } catch (error) {
        logger.error('[ImageOcclusionEditor] Failed to save media:', error);
        Alert.alert('Error', 'Failed to save image');
      }
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Camera permission is required to take photos');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);

      Image.getSize(
        asset.uri,
        (w, h) => {
          setImageDimensions({ width: w, height: h });
        },
        (error) => {
          logger.error('[ImageOcclusionEditor] Failed to get image size:', error);
        }
      );

      try {
        const media = await mediaService.addMediaFile(asset.uri);
        setImageFilename(media.filename);
      } catch (error) {
        logger.error('[ImageOcclusionEditor] Failed to save media:', error);
        Alert.alert('Error', 'Failed to save image');
      }
    }
  };

  // Add a new mask at center
  const addMask = () => {
    if (!imageUri) return;

    const newMask: Mask = {
      id: `m${Date.now()}`,
      x: 0.35,
      y: 0.35,
      w: 0.3,
      h: 0.3,
    };

    setMasks([...masks, newMask]);
    setSelectedMaskId(newMask.id);
  };

  // Delete selected mask
  const deleteMask = () => {
    if (!selectedMaskId) return;
    setMasks(masks.filter((m) => m.id !== selectedMaskId));
    setSelectedMaskId(null);
  };

  // Save the occlusion note
  const saveOcclusion = async () => {
    if (!imageFilename || masks.length === 0) {
      Alert.alert('Incomplete', 'Please add an image and at least one mask');
      return;
    }

    try {
      const model = db.getModel(3);
      if (!model) {
        Alert.alert('Error', 'Image Occlusion model not found');
        return;
      }

      const noteData = {
        io: {
          version: 1,
          image: imageFilename,
          mode,
          masks,
          naturalSize: imageDimensions,
        },
      };

      const note = noteService.createNote({
        modelId: 3,
        deckId,
        fields: [imageFilename, extraText],
        tags: [],
      });

      db.updateNote(note.id, {
        data: JSON.stringify(noteData),
      });

      logger.info('[ImageOcclusionEditor] Created note with', masks.length, 'masks');
      navigation.goBack();
    } catch (error) {
      logger.error('[ImageOcclusionEditor] Failed to save:', error);
      Alert.alert('Error', 'Failed to save occlusion note');
    }
  };

  const maxDisplayWidth = width - s.lg * 2;
  const aspectRatio = imageDimensions.height / imageDimensions.width || 1;
  const displayWidth = maxDisplayWidth;
  const displayHeight = displayWidth * aspectRatio;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>Image Occlusion</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView style={styles.content}>
        {!imageUri ? (
          <View style={styles.imagePickerContainer}>
            <Text style={[styles.bodyText, { color: theme.colors.textPrimary, marginBottom: s.md, textAlign: 'center' }]}>
              Select an image to create occlusions
            </Text>
            <View style={styles.buttonRow}>
              <Pressable onPress={pickImage} style={[styles.button, { backgroundColor: theme.colors.accent, flex: 1 }]}>
                <Ionicons name="images" size={20} color="#000" />
                <Text style={styles.buttonText}>Library</Text>
              </Pressable>
              <Pressable onPress={takePhoto} style={[styles.button, { backgroundColor: theme.colors.accent, flex: 1 }]}>
                <Ionicons name="camera" size={20} color="#000" />
                <Text style={styles.buttonText}>Camera</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.imageContainer}>
              <View style={{ width: displayWidth, height: displayHeight, position: 'relative' }}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: displayWidth, height: displayHeight }}
                  resizeMode="contain"
                />
                {masks.map((mask) => {
                  const left = mask.x * displayWidth;
                  const top = mask.y * displayHeight;
                  const maskWidth = mask.w * displayWidth;
                  const maskHeight = mask.h * displayHeight;
                  const isSelected = mask.id === selectedMaskId;

                  return (
                    <Pressable
                      key={mask.id}
                      onPress={() => setSelectedMaskId(mask.id)}
                      style={[
                        styles.mask,
                        {
                          left,
                          top,
                          width: maskWidth,
                          height: maskHeight,
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(0, 0, 0, 0.6)',
                          borderColor: isSelected ? '#3B82F6' : '#888',
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                    />
                  );
                })}
              </View>
            </View>

            <View style={styles.controls}>
              <View style={styles.controlRow}>
                <Pressable onPress={addMask} style={[styles.button, { backgroundColor: theme.colors.accent, flex: 1 }]}>
                  <Ionicons name="add" size={20} color="#000" />
                  <Text style={styles.buttonText}>Add Mask</Text>
                </Pressable>
                <Pressable
                  onPress={deleteMask}
                  disabled={!selectedMaskId}
                  style={[styles.button, { backgroundColor: theme.colors.accent, flex: 1, opacity: selectedMaskId ? 1 : 0.5 }]}
                >
                  <Ionicons name="trash" size={20} color="#000" />
                  <Text style={styles.buttonText}>Delete</Text>
                </Pressable>
              </View>

              <View style={styles.modeContainer}>
                <Text style={[styles.label, { color: theme.colors.textPrimary, marginBottom: s.sm }]}>
                  Occlusion Mode:
                </Text>
                <View style={styles.buttonRow}>
                  <Pressable
                    onPress={() => setMode('hide-one')}
                    style={[
                      styles.modeButton,
                      { backgroundColor: mode === 'hide-one' ? theme.colors.accent : theme.colors.surface },
                    ]}
                  >
                    <Text style={[styles.modeText, { color: mode === 'hide-one' ? '#000' : theme.colors.textPrimary, fontWeight: mode === 'hide-one' ? '600' : '400' }]}>
                      Hide One
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setMode('hide-all')}
                    style={[
                      styles.modeButton,
                      { backgroundColor: mode === 'hide-all' ? theme.colors.accent : theme.colors.surface },
                    ]}
                  >
                    <Text style={[styles.modeText, { color: mode === 'hide-all' ? '#000' : theme.colors.textPrimary, fontWeight: mode === 'hide-all' ? '600' : '400' }]}>
                      Hide All
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.extraContainer}>
                <Text style={[styles.label, { color: theme.colors.textPrimary, marginBottom: s.sm }]}>
                  Extra (optional):
                </Text>
                <TextInput
                  value={extraText}
                  onChangeText={setExtraText}
                  placeholder="Additional notes..."
                  placeholderTextColor={theme.colors.textSecondary}
                  multiline
                  style={[
                    styles.extraInput,
                    {
                      backgroundColor: theme.colors.surface,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border,
                    },
                  ]}
                />
              </View>

              <Pressable
                onPress={saveOcclusion}
                disabled={masks.length === 0}
                style={[styles.button, { backgroundColor: theme.colors.accent, opacity: masks.length === 0 ? 0.5 : 1 }]}
              >
                <Text style={styles.buttonText}>
                  Save Occlusion ({masks.length} mask{masks.length !== 1 ? 's' : ''})
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderBottomWidth: 1,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: s.lg,
  },
  imagePickerContainer: {
    alignItems: 'center',
    paddingVertical: s.xl * 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: s.md,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s.md,
    borderRadius: r.md,
    gap: s.xs,
  },
  buttonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 16,
  },
  bodyText: {
    fontSize: 16,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: s.lg,
  },
  mask: {
    position: 'absolute',
    borderRadius: 4,
  },
  controls: {
    gap: s.lg,
  },
  controlRow: {
    flexDirection: 'row',
    gap: s.md,
  },
  modeContainer: {
    marginTop: s.md,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  modeButton: {
    flex: 1,
    padding: s.md,
    borderRadius: r.md,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 16,
  },
  extraContainer: {
    marginTop: s.md,
  },
  extraInput: {
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    minHeight: 80,
    textAlignVertical: 'top',
    fontSize: 16,
  },
});
