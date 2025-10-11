import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ScrollView, TextInput, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EmojiPicker from 'rn-emoji-keyboard';
import TriangleColorPicker from 'react-native-wheel-color-picker';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import { DeckMetadata } from '../../../services/anki/DeckMetadataService';

const { width } = Dimensions.get('window');

interface DeckCustomizationModalProps {
  visible: boolean;
  deckName: string;
  currentMetadata: DeckMetadata | null;
  onSave: (metadata: Partial<Omit<DeckMetadata, 'deckId'>>) => void;
  onClose: () => void;
}

// Icon categories - 200+ icons total
const ICON_CATEGORIES = {
  Education: [
    'book', 'book-outline', 'library', 'library-outline', 'school', 'school-outline',
    'calculator-outline', 'pencil', 'pencil-outline', 'create', 'create-outline',
    'document-text', 'document-text-outline', 'document', 'document-outline',
    'newspaper', 'newspaper-outline', 'reader', 'reader-outline', 'documents', 'documents-outline',
    'clipboard', 'clipboard-outline', 'journal', 'bookmark', 'bookmark-outline',
    'bookmarks', 'bookmarks-outline', 'albums', 'albums-outline'
  ],
  Science: [
    'flask', 'flask-outline', 'beaker', 'beaker-outline', 'medical', 'medical-outline',
    'pulse', 'pulse-outline', 'heart', 'heart-outline',
    'nutrition', 'nutrition-outline',
    'eyedrop', 'eyedrop-outline', 'magnet', 'magnet-outline', 'thermometer', 'thermometer-outline',
    'telescope', 'battery-full', 'battery-half', 'bandage', 'bandage-outline'
  ],
  Languages: [
    'language', 'globe', 'globe-outline', 'earth', 'earth-outline',
    'flag', 'flag-outline', 'location', 'location-outline',
    'compass', 'compass-outline', 'pin', 'pin-outline',
    'chatbubble', 'chatbubble-outline', 'chatbubbles', 'chatbubbles-outline',
    'text', 'text-outline', 'megaphone', 'megaphone-outline'
  ],
  Tech: [
    'code-slash', 'code-slash-outline', 'terminal', 'terminal-outline', 'bug', 'bug-outline',
    'hardware-chip', 'hardware-chip-outline', 'server', 'server-outline',
    'laptop', 'laptop-outline', 'desktop', 'desktop-outline',
    'phone-portrait', 'phone-portrait-outline', 'tablet-portrait', 'tablet-portrait-outline',
    'watch', 'watch-outline', 'wifi', 'wifi-outline', 'bluetooth', 'bluetooth-outline',
    'cloud', 'cloud-outline', 'cloud-upload', 'cloud-download', 'download', 'download-outline'
  ],
  Business: [
    'business', 'business-outline', 'briefcase', 'briefcase-outline',
    'cash', 'cash-outline', 'card', 'card-outline', 'wallet', 'wallet-outline',
    'trending-up', 'trending-up-outline', 'trending-down', 'trending-down-outline',
    'stats-chart', 'stats-chart-outline', 'pie-chart', 'pie-chart-outline',
    'analytics', 'analytics-outline', 'bar-chart', 'bar-chart-outline',
    'receipt', 'receipt-outline', 'pricetag', 'pricetag-outline'
  ],
  Music: [
    'musical-notes', 'musical-notes-outline', 'musical-note', 'musical-note-outline',
    'headset', 'headset-outline', 'mic', 'mic-outline', 'mic-off', 'mic-off-outline',
    'camera', 'camera-outline', 'videocam', 'videocam-outline',
    'brush', 'brush-outline', 'color-palette', 'color-palette-outline',
    'easel', 'easel-outline', 'film', 'film-outline', 'images', 'images-outline',
    'image', 'image-outline', 'play', 'play-outline', 'pause', 'pause-outline'
  ],
  Sports: [
    'barbell', 'barbell-outline', 'basketball', 'basketball-outline', 
    'football', 'football-outline', 'baseball', 'baseball-outline',
    'walk', 'walk-outline', 'body', 'body-outline',
    'trophy', 'trophy-outline', 'medal', 'medal-outline', 'ribbon', 'ribbon-outline',
    'disc', 'american-football', 'golf', 'golf-outline'
  ],
  Transport: [
    'car', 'car-outline', 'car-sport', 'car-sport-outline', 'bus', 'bus-outline',
    'train', 'train-outline', 'subway', 'airplane', 'airplane-outline',
    'boat', 'boat-outline', 'bike', 'rocket', 'rocket-outline',
    'speedometer', 'speedometer-outline'
  ],
  Home: [
    'home', 'home-outline', 'bed', 'bed-outline', 'bulb', 'bulb-outline',
    'gift', 'gift-outline', 'key', 'key-outline', 'lock-closed', 'lock-closed-outline',
    'restaurant', 'restaurant-outline', 'cafe', 'cafe-outline', 'pizza', 'pizza-outline',
    'fast-food', 'fast-food-outline', 'beer', 'beer-outline', 'wine', 'wine-outline',
    'ice-cream', 'ice-cream-outline', 'egg', 'egg-outline'
  ],
  Nature: [
    'sunny', 'sunny-outline', 'moon', 'moon-outline', 'cloudy', 'cloudy-outline',
    'rainy', 'rainy-outline', 'snow', 'snow-outline', 'thunderstorm', 'thunderstorm-outline',
    'flower', 'flower-outline', 'rose', 'rose-outline',
    'flash', 'flash-outline',
    'umbrella', 'umbrella-outline', 'planet', 'planet-outline'
  ],
  Fun: [
    'game-controller', 'game-controller-outline', 'dice', 'dice-outline',
    'star', 'star-outline', 'star-half', 'star-half-outline',
    'diamond', 'diamond-outline',
    'shield', 'shield-outline', 'skull', 'skull-outline',
    'happy', 'happy-outline', 'sparkles', 'sparkles-outline'
  ],
};

export default function DeckCustomizationModalV2({
  visible,
  deckName,
  currentMetadata,
  onSave,
  onClose,
}: DeckCustomizationModalProps) {
  const theme = useTheme();
  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(currentMetadata?.icon);
  const [selectedColor, setSelectedColor] = useState<string | undefined>(currentMetadata?.color);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconSearchQuery, setIconSearchQuery] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedIcon(currentMetadata?.icon);
      setSelectedColor(currentMetadata?.color);
      setIconSearchQuery('');
    }
  }, [visible, currentMetadata]);

  // Flatten all icons for picker
  const allIcons = useMemo(() => {
    return Object.values(ICON_CATEGORIES).flat();
  }, []);

  const filteredIcons = useMemo(() => {
    if (!iconSearchQuery) return allIcons;
    return allIcons.filter(icon => icon.toLowerCase().includes(iconSearchQuery.toLowerCase()));
  }, [allIcons, iconSearchQuery]);

  const handleSave = () => {
    onSave({
      icon: selectedIcon,
      color: selectedColor,
    });
    onClose();
  };

  const handleClear = () => {
    onSave({ icon: undefined, color: undefined });
    onClose();
  };

  const isEmoji = selectedIcon && selectedIcon.length <= 2 && !/^[a-z-]+$/.test(selectedIcon);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          {/* Sticky Header with Preview */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.headerTop}>
              <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
                Customize
              </Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={28} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            
            {/* Live Preview */}
            <View style={[
              styles.previewCard,
              {
                backgroundColor: selectedColor ? selectedColor + '15' : theme.colors.bg,
                borderColor: selectedColor || theme.colors.border,
              }
            ]}>
              {selectedIcon && (
                isEmoji ? (
                  <Text style={styles.previewEmoji}>{selectedIcon}</Text>
                ) : (
                  <Ionicons name={selectedIcon as any} size={32} color={selectedColor || theme.colors.accent} />
                )
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {deckName}
                </Text>
                <Text style={[styles.previewHint, { color: theme.colors.textSecondary }]}>
                  {selectedIcon || selectedColor ? 'Preview' : 'Select icon & color below'}
                </Text>
              </View>
            </View>
          </View>

          {/* Scrollable Content - Clean Picker Cards */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Icon or Emoji Picker Card */}
            <Pressable
              style={[
                styles.pickerCard,
                {
                  backgroundColor: theme.colors.bg,
                  borderColor: theme.colors.border,
                }
              ]}
              onPress={() => setIsIconPickerOpen(true)}
            >
              <View style={styles.pickerLeft}>
                <Ionicons name="apps" size={24} color={theme.colors.accent} />
                <View>
                  <Text style={[styles.pickerLabel, { color: theme.colors.textPrimary }]}>
                    Icon or Emoji
                  </Text>
                  <Text style={[styles.pickerHint, { color: theme.colors.textSecondary }]}>
                    Choose one
                  </Text>
                </View>
              </View>
              {selectedIcon ? (
                isEmoji ? (
                  <Text style={styles.pickerEmoji}>{selectedIcon}</Text>
                ) : (
                  <Ionicons name={selectedIcon as any} size={28} color={theme.colors.accent} />
                )
              ) : (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              )}
            </Pressable>

            {/* Color Picker Card */}
            <Pressable
              style={[
                styles.pickerCard,
                {
                  backgroundColor: theme.colors.bg,
                  borderColor: theme.colors.border,
                }
              ]}
              onPress={() => setIsColorPickerOpen(true)}
            >
              <View style={styles.pickerLeft}>
                <Ionicons name="color-palette" size={24} color={theme.colors.accent} />
                <Text style={[styles.pickerLabel, { color: theme.colors.textPrimary }]}>
                  Color
                </Text>
              </View>
              {selectedColor ? (
                <View style={styles.pickerColorPreview}>
                  <View style={[styles.pickerColorCircle, { backgroundColor: selectedColor }]} />
                  <Text style={[styles.pickerColorText, { color: theme.colors.textSecondary }]}>
                    {selectedColor.toUpperCase()}
                  </Text>
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
              )}
            </Pressable>

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Sticky Footer */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Pressable
              style={[styles.button, { backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border }]}
              onPress={handleClear}
            >
              <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>
                Clear
              </Text>
            </Pressable>
            <Pressable
              style={[styles.button, { backgroundColor: theme.colors.accent }]}
              onPress={handleSave}
            >
              <Text style={[styles.buttonText, { color: '#FFF' }]}>
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Emoji Picker */}
      <EmojiPicker
        onEmojiSelected={(emoji) => {
          setSelectedIcon(emoji.emoji);
          setIsEmojiPickerOpen(false);
        }}
        open={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        theme={{
          backdrop: theme.colors.bg + 'CC',
          knob: theme.colors.textSecondary,
          container: theme.colors.surface,
          header: theme.colors.textPrimary,
          skinTonesContainer: theme.colors.bg,
          category: {
            icon: theme.colors.textSecondary,
            iconActive: theme.colors.accent,
            container: theme.colors.bg,
            containerActive: theme.colors.accent + '20',
          },
        }}
      />

      {/* Icon Picker Modal - Combined Icons & Emoji */}
      <Modal
        visible={isIconPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsIconPickerOpen(false)}
      >
        <View style={[styles.colorPickerOverlay, { backgroundColor: theme.colors.bg + 'EE' }]}>
          <View style={[styles.iconPickerModal, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.iconPickerHeader}>
              <Text style={[styles.iconPickerTitle, { color: theme.colors.textPrimary }]}>
                Pick Icon or Emoji
              </Text>
              <Pressable onPress={() => setIsIconPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.iconPickerTabs}>
              <Pressable
                style={[
                  styles.iconPickerTab,
                  {
                    backgroundColor: !isEmojiPickerOpen ? theme.colors.accent : 'transparent',
                    borderColor: !isEmojiPickerOpen ? theme.colors.accent : theme.colors.border,
                  }
                ]}
                onPress={() => setIsEmojiPickerOpen(false)}
              >
                <Text style={[
                  styles.iconPickerTabText,
                  { color: !isEmojiPickerOpen ? '#FFF' : theme.colors.textSecondary }
                ]}>
                  Icons
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.iconPickerTab,
                  {
                    backgroundColor: isEmojiPickerOpen ? theme.colors.accent : 'transparent',
                    borderColor: isEmojiPickerOpen ? theme.colors.accent : theme.colors.border,
                  }
                ]}
                onPress={() => {
                  setIsEmojiPickerOpen(true);
                  setIsIconPickerOpen(false);
                }}
              >
                <Text style={[
                  styles.iconPickerTabText,
                  { color: isEmojiPickerOpen ? '#FFF' : theme.colors.textSecondary }
                ]}>
                  Emoji
                </Text>
              </Pressable>
            </View>

            {/* Search */}
            <TextInput
              style={[
                styles.iconSearch,
                {
                  backgroundColor: theme.colors.bg,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                }
              ]}
              placeholder="Search icons..."
              placeholderTextColor={theme.colors.textSecondary}
              value={iconSearchQuery}
              onChangeText={setIconSearchQuery}
            />

            {/* Icon Grid */}
            <ScrollView style={styles.iconPickerContent} showsVerticalScrollIndicator={false}>
              <View style={styles.iconPickerGrid}>
                {filteredIcons.map((icon) => (
                  <Pressable
                    key={icon}
                    style={[
                      styles.iconPickerButton,
                      {
                        backgroundColor: selectedIcon === icon 
                          ? theme.colors.accent + '20'
                          : theme.colors.bg,
                        borderColor: selectedIcon === icon
                          ? theme.colors.accent
                          : theme.colors.border,
                      }
                    ]}
                    onPress={() => {
                      setSelectedIcon(icon);
                      setIsIconPickerOpen(false);
                      setIconSearchQuery('');
                    }}
                  >
                    <Ionicons 
                      name={icon as any} 
                      size={24} 
                      color={selectedIcon === icon ? theme.colors.accent : theme.colors.textPrimary} 
                    />
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Color Picker Modal */}
      <Modal
        visible={isColorPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsColorPickerOpen(false)}
      >
        <View style={[styles.colorPickerOverlay, { backgroundColor: theme.colors.bg + 'EE' }]}>
          <View style={[styles.colorPickerModal, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.colorPickerTitle, { color: theme.colors.textPrimary }]}>
              Pick a Color
            </Text>
            <View style={styles.colorPickerWrapper}>
              <TriangleColorPicker
                color={selectedColor || '#3B82F6'}
                onColorChange={(color: string) => setSelectedColor(color)}
              />
            </View>
            <View style={styles.colorPickerButtons}>
              <Pressable
                style={[styles.colorPickerBtn, { backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border }]}
                onPress={() => setIsColorPickerOpen(false)}
              >
                <Text style={[styles.colorPickerBtnText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                style={[styles.colorPickerBtn, { backgroundColor: theme.colors.accent }]}
                onPress={() => setIsColorPickerOpen(false)}
              >
                <Text style={[styles.colorPickerBtnText, { color: '#FFF' }]}>
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    maxHeight: '70%',
    height: '70%',
  },
  header: {
    paddingHorizontal: s.lg,
    paddingTop: s.lg,
    paddingBottom: s.md,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    padding: s.lg,
    borderRadius: r.lg,
    borderWidth: 2,
  },
  previewEmoji: {
    fontSize: 32,
  },
  previewName: {
    fontSize: 18,
    fontWeight: '600',
  },
  previewHint: {
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: s.lg,
    paddingTop: s.lg,
  },
  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: s.lg,
    borderRadius: r.lg,
    borderWidth: 1,
    marginBottom: s.md,
  },
  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  pickerLabel: {
    fontSize: 17,
    fontWeight: '600',
  },
  pickerHint: {
    fontSize: 13,
    marginTop: 2,
  },
  pickerEmoji: {
    fontSize: 32,
  },
  pickerColorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  pickerColorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  pickerColorText: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    gap: s.md,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: s.md,
    borderRadius: r.lg,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Icon Picker
  iconPickerModal: {
    width: '100%',
    maxWidth: 500,
    height: '80%',
    borderRadius: r.xl,
    padding: s.xl,
  },
  iconPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  iconPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  iconPickerTabs: {
    flexDirection: 'row',
    gap: s.sm,
    marginBottom: s.md,
  },
  iconPickerTab: {
    flex: 1,
    paddingVertical: s.sm,
    borderRadius: r.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconPickerTabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  iconSearch: {
    fontSize: 16,
    padding: s.md,
    borderRadius: r.lg,
    borderWidth: 1,
    marginBottom: s.lg,
  },
  iconPickerContent: {
    flex: 1,
  },
  iconPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.sm,
  },
  iconPickerButton: {
    width: (width - s.xl * 2 - s.sm * 7) / 8,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.md,
    borderWidth: 1,
  },
  // Color Picker
  colorPickerOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.xl,
  },
  colorPickerModal: {
    width: '100%',
    maxWidth: 400,
    borderRadius: r.xl,
    padding: s.xl,
    alignItems: 'center',
  },
  colorPickerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: s.xl,
  },
  colorPickerWrapper: {
    width: 280,
    height: 280,
    marginBottom: s.xl,
  },
  colorPickerButtons: {
    flexDirection: 'row',
    gap: s.md,
    width: '100%',
  },
  colorPickerBtn: {
    flex: 1,
    paddingVertical: s.md,
    borderRadius: r.lg,
    alignItems: 'center',
  },
  colorPickerBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
