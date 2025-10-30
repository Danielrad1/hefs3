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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { NoteService } from '../../services/anki/NoteService';
import { MediaService } from '../../services/anki/MediaService';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { useScheduler } from '../../context/SchedulerProvider';
import { generateId, nowSeconds } from '../../services/anki/time';
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

// Draggable mask component
const MIN_MASK_SIZE = 0.05;
const HANDLE_SIZE = 24; // Increased for easier touch

const clampValue = (value: number, min: number, max: number) => {
  'worklet';
  return Math.max(min, Math.min(max, value));
};

type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const DraggableMask = ({
  mask,
  isSelected,
  displayWidth,
  displayHeight,
  onUpdate,
  onSelect,
}: {
  mask: Mask;
  isSelected: boolean;
  displayWidth: number;
  displayHeight: number;
  onUpdate: (id: string, updates: Partial<Mask>) => void;
  onSelect: (id: string) => void;
}) => {
  const [activeHandle, setActiveHandle] = React.useState<ResizeCorner | null>(null);
  const baseLeft = mask.x * displayWidth;
  const baseTop = mask.y * displayHeight;
  const maskWidth = mask.w * displayWidth;
  const maskHeight = mask.h * displayHeight;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  // Shared values for resize animation
  const resizeOffsetX = useSharedValue(0);
  const resizeOffsetY = useSharedValue(0);
  const resizeOffsetW = useSharedValue(0);
  const resizeOffsetH = useSharedValue(0);

  const startX = useSharedValue(mask.x);
  const startY = useSharedValue(mask.y);
  const startW = useSharedValue(mask.w);
  const startH = useSharedValue(mask.h);
  const isResizingRef = React.useRef(false);

  const setResizing = React.useCallback((value: boolean) => {
    isResizingRef.current = value;
  }, []);

  React.useEffect(() => {
    if (isResizingRef.current) return;
    startX.value = mask.x;
    startY.value = mask.y;
    startW.value = mask.w;
    startH.value = mask.h;
    // Reset resize offsets when mask changes
    resizeOffsetX.value = 0;
    resizeOffsetY.value = 0;
    resizeOffsetW.value = 0;
    resizeOffsetH.value = 0;
  }, [mask, startX, startY, startW, startH, resizeOffsetX, resizeOffsetY, resizeOffsetW, resizeOffsetH]);

  // Simple pan gesture for moving (only when no handle is active)
  const panGesture = Gesture.Pan()
    .enabled(!activeHandle)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      const newX = Math.max(0, Math.min(1, (baseLeft + e.translationX) / displayWidth));
      const newY = Math.max(0, Math.min(1, (baseTop + e.translationY) / displayHeight));

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);

      runOnJS(onUpdate)(mask.id, { x: newX, y: newY });
    });

  const tapGesture = Gesture.Tap()
    .enabled(!activeHandle)
    .onEnd(() => runOnJS(onSelect)(mask.id));

  const animatedStyle = useAnimatedStyle(() => {
    const left = resizeOffsetX.value * displayWidth;
    const top = resizeOffsetY.value * displayHeight;
    const width = resizeOffsetW.value * displayWidth;
    const height = resizeOffsetH.value * displayHeight;
    
    return {
      transform: [{ translateX: translateX.value + left }, { translateY: translateY.value + top }],
      width: maskWidth + width,
      height: maskHeight + height,
    };
  });

  const applyResize = React.useCallback(
    (
      corner: ResizeCorner,
      id: string,
      dx: number,
      dy: number,
      start: { x: number; y: number; w: number; h: number },
    ) => {
      let newX = start.x;
      let newY = start.y;
      let newW = start.w;
      let newH = start.h;

      const clampWidth = (x: number, width: number) => clampValue(width, MIN_MASK_SIZE, 1 - x);
      const clampHeight = (y: number, height: number) => clampValue(height, MIN_MASK_SIZE, 1 - y);

      switch (corner) {
        case 'top-left': {
          newX = clampValue(start.x + dx, 0, start.x + start.w - MIN_MASK_SIZE);
          newY = clampValue(start.y + dy, 0, start.y + start.h - MIN_MASK_SIZE);
          newW = clampWidth(newX, start.x + start.w - newX);
          newH = clampHeight(newY, start.y + start.h - newY);
          break;
        }
        case 'top-right': {
          newY = clampValue(start.y + dy, 0, start.y + start.h - MIN_MASK_SIZE);
          newW = clampWidth(start.x, start.w + dx);
          newH = clampHeight(newY, start.y + start.h - newY);
          break;
        }
        case 'bottom-left': {
          newX = clampValue(start.x + dx, 0, start.x + start.w - MIN_MASK_SIZE);
          newW = clampWidth(newX, start.x + start.w - newX);
          newH = clampHeight(start.y, start.h + dy);
          break;
        }
        case 'bottom-right': {
          newW = clampWidth(start.x, start.w + dx);
          newH = clampHeight(start.y, start.h + dy);
          break;
        }
      }

      onUpdate(id, { x: newX, y: newY, w: newW, h: newH });
    },
    [onUpdate],
  );

  const initResizeGesture = () => {
    'worklet';
    startX.value = mask.x;
    startY.value = mask.y;
    startW.value = mask.w;
    startH.value = mask.h;
    resizeOffsetX.value = 0;
    resizeOffsetY.value = 0;
    resizeOffsetW.value = 0;
    resizeOffsetH.value = 0;
    runOnJS(setResizing)(true);
    runOnJS(onSelect)(mask.id);
  };

  const calculateResize = (
    corner: ResizeCorner,
    dx: number,
    dy: number,
    start: { x: number; y: number; w: number; h: number },
  ) => {
    'worklet';
    let newX = start.x;
    let newY = start.y;
    let newW = start.w;
    let newH = start.h;

    const clampWidth = (x: number, width: number) => clampValue(width, MIN_MASK_SIZE, 1 - x);
    const clampHeight = (y: number, height: number) => clampValue(height, MIN_MASK_SIZE, 1 - y);

    switch (corner) {
      case 'top-left': {
        newX = clampValue(start.x + dx, 0, start.x + start.w - MIN_MASK_SIZE);
        newY = clampValue(start.y + dy, 0, start.y + start.h - MIN_MASK_SIZE);
        newW = clampWidth(newX, start.x + start.w - newX);
        newH = clampHeight(newY, start.y + start.h - newY);
        break;
      }
      case 'top-right': {
        newY = clampValue(start.y + dy, 0, start.y + start.h - MIN_MASK_SIZE);
        newW = clampWidth(start.x, start.w + dx);
        newH = clampHeight(newY, start.y + start.h - newY);
        break;
      }
      case 'bottom-left': {
        newX = clampValue(start.x + dx, 0, start.x + start.w - MIN_MASK_SIZE);
        newW = clampWidth(newX, start.x + start.w - newX);
        newH = clampHeight(start.y, start.h + dy);
        break;
      }
      case 'bottom-right': {
        newW = clampWidth(start.x, start.w + dx);
        newH = clampHeight(start.y, start.h + dy);
        break;
      }
    }

    return { x: newX, y: newY, w: newW, h: newH };
  };

  const topLeftGesture = Gesture.Pan()
    .hitSlop(HANDLE_SIZE)
    .onBegin(() => {
      runOnJS(setActiveHandle)('top-left');
      initResizeGesture();
    })
    .onUpdate((e) => {
      const dx = e.translationX / displayWidth;
      const dy = e.translationY / displayHeight;
      const result = calculateResize('top-left', dx, dy, {
        x: startX.value,
        y: startY.value,
        w: startW.value,
        h: startH.value,
      });
      resizeOffsetX.value = result.x - startX.value;
      resizeOffsetY.value = result.y - startY.value;
      resizeOffsetW.value = result.w - startW.value;
      resizeOffsetH.value = result.h - startH.value;
    })
    .onEnd((e) => {
      const dx = e.translationX / displayWidth;
      const dy = e.translationY / displayHeight;
      resizeOffsetX.value = withSpring(0);
      resizeOffsetY.value = withSpring(0);
      resizeOffsetW.value = withSpring(0);
      resizeOffsetH.value = withSpring(0);
      runOnJS(applyResize)('top-left', mask.id, dx, dy, {
        x: startX.value,
        y: startY.value,
        w: startW.value,
        h: startH.value,
      });
      runOnJS(setResizing)(false);
      runOnJS(setActiveHandle)(null);
    })
    .onFinalize(() => {
      runOnJS(setResizing)(false);
      runOnJS(setActiveHandle)(null);
    });

  const topRightGesture = Gesture.Pan()
    .hitSlop(HANDLE_SIZE)
    .onBegin(() => {
      runOnJS(setActiveHandle)('top-right');
      initResizeGesture();
    })
    .onUpdate((e) => {
      const dx = e.translationX / displayWidth;
      const dy = e.translationY / displayHeight;
      const result = calculateResize('top-right', dx, dy, {
        x: startX.value,
        y: startY.value,
        w: startW.value,
        h: startH.value,
      });
      resizeOffsetX.value = result.x - startX.value;
      resizeOffsetY.value = result.y - startY.value;
      resizeOffsetW.value = result.w - startW.value;
      resizeOffsetH.value = result.h - startH.value;
    })
    .onEnd((e) => {
      const dx = e.translationX / displayWidth;
      const dy = e.translationY / displayHeight;
      resizeOffsetX.value = withSpring(0);
      resizeOffsetY.value = withSpring(0);
      resizeOffsetW.value = withSpring(0);
      resizeOffsetH.value = withSpring(0);
      runOnJS(applyResize)('top-right', mask.id, dx, dy, {
        x: startX.value,
        y: startY.value,
        w: startW.value,
        h: startH.value,
      });
      runOnJS(setResizing)(false);
      runOnJS(setActiveHandle)(null);
    })
    .onFinalize(() => {
      runOnJS(setResizing)(false);
      runOnJS(setActiveHandle)(null);
    });

  const bottomLeftGesture = Gesture.Pan()
    .hitSlop(HANDLE_SIZE)
    .onBegin(() => {
      runOnJS(setActiveHandle)('bottom-left');
      initResizeGesture();
    })
    .onUpdate((e) => {
      const dx = e.translationX / displayWidth;
      const dy = e.translationY / displayHeight;
      const result = calculateResize('bottom-left', dx, dy, {
        x: startX.value,
        y: startY.value,
        w: startW.value,
        h: startH.value,
      });
      resizeOffsetX.value = result.x - startX.value;
      resizeOffsetY.value = result.y - startY.value;
      resizeOffsetW.value = result.w - startW.value;
      resizeOffsetH.value = result.h - startH.value;
    })
    .onEnd((e) => {
      const dx = e.translationX / displayWidth;
      const dy = e.translationY / displayHeight;
      resizeOffsetX.value = withSpring(0);
      resizeOffsetY.value = withSpring(0);
      resizeOffsetW.value = withSpring(0);
      resizeOffsetH.value = withSpring(0);
      runOnJS(applyResize)('bottom-left', mask.id, dx, dy, {
        x: startX.value,
        y: startY.value,
        w: startW.value,
        h: startH.value,
      });
      runOnJS(setResizing)(false);
      runOnJS(setActiveHandle)(null);
    })
    .onFinalize(() => {
      runOnJS(setResizing)(false);
      runOnJS(setActiveHandle)(null);
    });

  const bottomRightGesture = Gesture.Pan()
    .hitSlop(HANDLE_SIZE)
    .onBegin(() => {
      runOnJS(setActiveHandle)('bottom-right');
      initResizeGesture();
    })
    .onUpdate((e) => {
      const dx = e.translationX / displayWidth;
      const dy = e.translationY / displayHeight;
      const result = calculateResize('bottom-right', dx, dy, {
        x: startX.value,
        y: startY.value,
        w: startW.value,
        h: startH.value,
      });
      resizeOffsetX.value = result.x - startX.value;
      resizeOffsetY.value = result.y - startY.value;
      resizeOffsetW.value = result.w - startW.value;
      resizeOffsetH.value = result.h - startH.value;
    })
    .onEnd((e) => {
      const dx = e.translationX / displayWidth;
      const dy = e.translationY / displayHeight;
      resizeOffsetX.value = withSpring(0);
      resizeOffsetY.value = withSpring(0);
      resizeOffsetW.value = withSpring(0);
      resizeOffsetH.value = withSpring(0);
      runOnJS(applyResize)('bottom-right', mask.id, dx, dy, {
        x: startX.value,
        y: startY.value,
        w: startW.value,
        h: startH.value,
      });
      runOnJS(setResizing)(false);
      runOnJS(setActiveHandle)(null);
    })
    .onFinalize(() => {
      runOnJS(setResizing)(false);
      runOnJS(setActiveHandle)(null);
    });

  return (
    <GestureDetector gesture={Gesture.Race(panGesture, tapGesture)}>
      <Animated.View
        style={[
          styles.mask,
          {
            left: baseLeft,
            top: baseTop,
            width: maskWidth,
            height: maskHeight,
            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.5)' : 'rgba(0, 0, 0, 1)',
            borderColor: isSelected ? '#3B82F6' : '#888',
            borderWidth: isSelected ? 2 : 1,
          },
          animatedStyle,
        ]}
      >
        {isSelected && (
          <>
            <GestureDetector gesture={topLeftGesture}>
              <View
                style={[styles.resizeHandle, { left: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 }]}
                pointerEvents="auto"
              />
            </GestureDetector>
            <GestureDetector gesture={topRightGesture}>
              <View
                style={[styles.resizeHandle, { right: -HANDLE_SIZE / 2, top: -HANDLE_SIZE / 2 }]}
                pointerEvents="auto"
              />
            </GestureDetector>
            <GestureDetector gesture={bottomLeftGesture}>
              <View
                style={[styles.resizeHandle, { left: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2 }]}
                pointerEvents="auto"
              />
            </GestureDetector>
            <GestureDetector gesture={bottomRightGesture}>
              <View
                style={[styles.resizeHandle, { right: -HANDLE_SIZE / 2, bottom: -HANDLE_SIZE / 2 }]}
                pointerEvents="auto"
              />
            </GestureDetector>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
};

export default function ImageOcclusionEditorScreen({
  route,
  navigation,
}: ImageOcclusionEditorScreenProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { deckId } = route.params;
  const { reload } = useScheduler();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string | null>(null);
  const [masks, setMasks] = useState<Mask[]>([]);
  const [mode, setMode] = useState<OcclusionMode>('hide-one');
  const [extraText, setExtraText] = useState('');
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const noteService = new NoteService(db);
  const mediaService = new MediaService(db);

  // Handle back navigation with unsaved changes
  const handleBack = () => {
    if (hasUnsavedChanges && masks.length > 0) {
      Alert.alert('Unsaved Changes', 'You have unsaved masks. Are you sure you want to leave?', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  // Mark as changed when masks or mode change
  React.useEffect(() => {
    if (masks.length > 0 || mode !== 'hide-one') {
      setHasUnsavedChanges(true);
    }
  }, [masks, mode]);

  // Show help dialog
  const showHelp = () => {
    Alert.alert(
      'Image Occlusion Help',
      '1. Select an image from library or camera\n' +
        '2. Tap "Add" to create masks over areas to hide\n' +
        '3. Tap masks to select them\n' +
        '4. Use "Duplicate" to copy selected mask\n' +
        '5. Choose occlusion mode:\n' +
        '   • Hide One: Each mask becomes its own card\n' +
        '   • Hide All: All masks hidden on same cards\n' +
        '6. Add optional extra info to show on back\n' +
        '7. Save to create your flashcards!',
      [{ text: 'Got it!' }],
    );
  };

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
        },
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
        },
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

  // Update mask position or size
  const updateMask = (maskId: string, updates: Partial<Mask>) => {
    setMasks(masks.map((m) => (m.id === maskId ? { ...m, ...updates } : m)));
  };

  // Duplicate selected mask
  const duplicateMask = () => {
    if (!selectedMaskId) return;
    const maskToDuplicate = masks.find((m) => m.id === selectedMaskId);
    if (!maskToDuplicate) return;

    const newMask: Mask = {
      id: `m${Date.now()}`,
      x: Math.min(maskToDuplicate.x + 0.05, 0.9),
      y: Math.min(maskToDuplicate.y + 0.05, 0.9),
      w: maskToDuplicate.w,
      h: maskToDuplicate.h,
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
    logger.info('[ImageOcclusionEditor] ===== SAVE STARTED =====');
    logger.info('[ImageOcclusionEditor] imageFilename:', imageFilename);
    logger.info('[ImageOcclusionEditor] masks count:', masks.length);
    logger.info('[ImageOcclusionEditor] masks:', JSON.stringify(masks));
    logger.info('[ImageOcclusionEditor] mode:', mode);
    logger.info('[ImageOcclusionEditor] deckId:', deckId);

    if (!imageFilename || masks.length === 0) {
      Alert.alert('Incomplete', 'Please add an image and at least one mask');
      return;
    }

    try {
      const model = db.getModel(3);
      logger.info('[ImageOcclusionEditor] Model found:', model?.name, 'type:', model?.type);

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

      logger.info('[ImageOcclusionEditor] Note data prepared:', JSON.stringify(noteData));

      // Create the note directly in the database with data already set
      const noteId = generateId();
      const now = nowSeconds();

      const note: any = {
        id: noteId,
        guid: `${Date.now()}${Math.random()}`, // Simple GUID for now
        mid: 3,
        mod: now,
        usn: -1,
        tags: ' ',
        flds: [imageFilename, extraText].join('\x1F'),
        sfld: 0,
        csum: 0,
        flags: 0,
        data: JSON.stringify(noteData), // Set data BEFORE adding to DB
      };

      logger.info('[ImageOcclusionEditor] Creating note directly with data:', note.id);

      db.addNote(note);

      logger.info('[ImageOcclusionEditor] Note added to DB, now generating cards');

      // Now trigger card generation using updateNote - note.data is already set!
      noteService.updateNote(note.id, {
        fields: [imageFilename, extraText],
        deckId,
      });

      logger.info('[ImageOcclusionEditor] updateNote called to trigger card generation');

      // Verify cards were created
      const createdCards = db.getAllCards().filter((c) => c.nid === note.id);
      logger.info(
        '[ImageOcclusionEditor] ===== CARDS CREATED:',
        createdCards.length,
        'cards for note',
        note.id,
      );

      if (createdCards.length === 0) {
        logger.error('[ImageOcclusionEditor] ❌ NO CARDS WERE CREATED!');
        const checkNote = db.getNote(note.id);
        logger.error('[ImageOcclusionEditor] Note data:', checkNote?.data);
        logger.error('[ImageOcclusionEditor] All cards in DB:', db.getAllCards().length);
      } else {
        logger.info(
          '[ImageOcclusionEditor] ✅ Cards created successfully:',
          createdCards.map((c) => ({ id: c.id, ord: c.ord })),
        );
      }

      // Persist to disk
      await PersistenceService.save(db);

      // Reload scheduler so cards show up immediately
      reload();

      const cardCount = mode === 'hide-one' ? masks.length : 1;
      logger.info(
        '[ImageOcclusionEditor] Created note with',
        masks.length,
        'masks,',
        cardCount,
        'cards',
      );

      setHasUnsavedChanges(false);

      // Show success and reset for next card
      Alert.alert(
        'Success!',
        `Created ${cardCount} card${cardCount !== 1 ? 's' : ''} from ${masks.length} mask${masks.length !== 1 ? 's' : ''}`,
        [
          {
            text: 'Create Another',
            onPress: () => {
              // Reset for next card
              setImageUri(null);
              setImageFilename(null);
              setMasks([]);
              setSelectedMaskId(null);
              setExtraText('');
              setMode('hide-one');
              setImageDimensions({ width: 0, height: 0 });
            },
          },
          {
            text: 'Done',
            onPress: () => {
              // Pop back to the deck/browser screen, skipping NoteEditor
              if (navigation.canGoBack()) {
                navigation.goBack(); // Go back from ImageOcclusionEditor
                // Use setTimeout to ensure first goBack completes
                setTimeout(() => {
                  if (navigation.canGoBack()) {
                    navigation.goBack(); // Go back from NoteEditor to Browser/Deck
                  }
                }, 50);
              }
            },
          },
        ],
      );
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
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <Pressable onPress={handleBack} style={styles.headerButton}>
            <Ionicons name="close" size={28} color={theme.colors.textPrimary} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]}>
            Image Occlusion
          </Text>
          <Pressable onPress={showHelp} style={styles.headerButton}>
            <Ionicons name="help-circle-outline" size={28} color={theme.colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {!imageUri ? (
            <View style={styles.imagePickerContainer}>
              <Text
                style={[
                  styles.bodyText,
                  { color: theme.colors.textPrimary, marginBottom: s.md, textAlign: 'center' },
                ]}
              >
                Select an image to create occlusions
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={pickImage}
                  style={[styles.button, { backgroundColor: theme.colors.accent, flex: 1 }]}
                >
                  <Ionicons name="images" size={20} color="#000" />
                  <Text style={styles.buttonText}>Library</Text>
                </Pressable>
                <Pressable
                  onPress={takePhoto}
                  style={[styles.button, { backgroundColor: theme.colors.accent, flex: 1 }]}
                >
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
                  {masks.map((mask) => (
                    <DraggableMask
                      key={mask.id}
                      mask={mask}
                      isSelected={mask.id === selectedMaskId}
                      displayWidth={displayWidth}
                      displayHeight={displayHeight}
                      onUpdate={updateMask}
                      onSelect={setSelectedMaskId}
                    />
                  ))}
                </View>
              </View>

              {/* Mask Info and Done Button */}
              {selectedMaskId && (
                <View style={styles.maskInfoContainer}>
                  <View
                    style={[
                      styles.maskInfo,
                      {
                        backgroundColor: theme.colors.surface,
                        borderColor: theme.colors.border,
                        flex: 1,
                      },
                    ]}
                  >
                    <Ionicons name="information-circle" size={20} color={theme.colors.accent} />
                    <Text style={[styles.maskInfoText, { color: theme.colors.textPrimary }]}>
                      Editing Mask {masks.findIndex((m) => m.id === selectedMaskId) + 1} of{' '}
                      {masks.length}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSelectedMaskId(null)}
                    style={[styles.doneButton, { backgroundColor: theme.colors.success }]}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFF" />
                    <Text style={[styles.doneButtonText, { color: '#FFF' }]}>Done</Text>
                  </Pressable>
                </View>
              )}

              <View style={styles.controls}>
                <View style={styles.controlRow}>
                  <Pressable
                    onPress={addMask}
                    style={[styles.button, { backgroundColor: theme.colors.accent, flex: 1 }]}
                  >
                    <Ionicons name="add" size={20} color="#000" />
                    <Text style={styles.buttonText}>Add</Text>
                  </Pressable>
                  <Pressable
                    onPress={duplicateMask}
                    disabled={!selectedMaskId}
                    style={[
                      styles.button,
                      {
                        backgroundColor: theme.colors.accent,
                        flex: 1,
                        opacity: selectedMaskId ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Ionicons name="copy" size={20} color="#000" />
                    <Text style={styles.buttonText}>Duplicate</Text>
                  </Pressable>
                  <Pressable
                    onPress={deleteMask}
                    disabled={!selectedMaskId}
                    style={[
                      styles.button,
                      {
                        backgroundColor: theme.colors.accent,
                        flex: 1,
                        opacity: selectedMaskId ? 1 : 0.5,
                      },
                    ]}
                  >
                    <Ionicons name="trash" size={20} color="#000" />
                    <Text style={styles.buttonText}>Delete</Text>
                  </Pressable>
                </View>

                <View style={styles.modeContainer}>
                  <Text
                    style={[styles.label, { color: theme.colors.textPrimary, marginBottom: s.sm }]}
                  >
                    Occlusion Mode:
                  </Text>
                  <Text
                    style={[
                      styles.modeHint,
                      { color: theme.colors.textSecondary, marginBottom: s.sm },
                    ]}
                  >
                    {mode === 'hide-one'
                      ? 'One mask hidden at a time (creates ' + masks.length + ' cards)'
                      : 'All masks hidden together (creates 1 card)'}
                  </Text>
                  <View style={styles.buttonRow}>
                    <Pressable
                      onPress={() => setMode('hide-one')}
                      style={[
                        styles.modeButton,
                        {
                          backgroundColor:
                            mode === 'hide-one' ? theme.colors.accent : theme.colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeText,
                          {
                            color: mode === 'hide-one' ? '#000' : theme.colors.textPrimary,
                            fontWeight: mode === 'hide-one' ? '600' : '400',
                          },
                        ]}
                      >
                        Hide One
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMode('hide-all')}
                      style={[
                        styles.modeButton,
                        {
                          backgroundColor:
                            mode === 'hide-all' ? theme.colors.accent : theme.colors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeText,
                          {
                            color: mode === 'hide-all' ? '#000' : theme.colors.textPrimary,
                            fontWeight: mode === 'hide-all' ? '600' : '400',
                          },
                        ]}
                      >
                        Hide All
                      </Text>
                    </Pressable>
                  </View>
                </View>

                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View style={styles.extraContainer}>
                    <Text
                      style={[
                        styles.label,
                        { color: theme.colors.textPrimary, marginBottom: s.sm },
                      ]}
                    >
                      Extra (optional):
                    </Text>
                    <TextInput
                      value={extraText}
                      onChangeText={setExtraText}
                      placeholder="Additional notes..."
                      placeholderTextColor={theme.colors.textSecondary}
                      multiline
                      blurOnSubmit={true}
                      returnKeyType="done"
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
                </TouchableWithoutFeedback>

                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    saveOcclusion();
                  }}
                  disabled={masks.length === 0}
                  style={[
                    styles.button,
                    { backgroundColor: theme.colors.accent, opacity: masks.length === 0 ? 0.5 : 1 },
                  ]}
                >
                  <Text style={styles.buttonText}>
                    Save Occlusion ({masks.length} mask{masks.length !== 1 ? 's' : ''})
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
    overflow: 'visible', // Allow handles to be touchable outside bounds
  },
  resizeHandle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: '#FFF',
    borderWidth: 3,
    borderColor: '#3B82F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  maskInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: s.md,
    gap: s.sm,
  },
  maskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.sm,
    borderRadius: r.md,
    borderWidth: 1,
    gap: s.xs,
  },
  maskInfoText: {
    fontSize: 14,
    fontWeight: '500',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.md,
    gap: s.xs,
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  modeHint: {
    fontSize: 13,
    fontStyle: 'italic',
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
