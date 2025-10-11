import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, TextInput, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    'calculator', 'calculator-outline', 'pencil', 'pencil-outline', 'create', 'create-outline',
    'document-text', 'document-text-outline', 'document', 'document-outline',
    'newspaper', 'newspaper-outline', 'reader', 'reader-outline', 'documents', 'documents-outline',
    'clipboard', 'clipboard-outline', 'journal', 'journals', 'bookmark', 'bookmark-outline',
    'bookmarks', 'bookmarks-outline', 'albums', 'albums-outline'
  ],
  Science: [
    'flask', 'flask-outline', 'beaker', 'beaker-outline', 'medical', 'medical-outline',
    'fitness', 'fitness-outline', 'pulse', 'pulse-outline', 'heart', 'heart-outline',
    'water', 'water-outline', 'leaf', 'leaf-outline', 'nutrition', 'nutrition-outline',
    'eyedrop', 'eyedrop-outline', 'magnet', 'magnet-outline', 'thermometer', 'thermometer-outline',
    'telescope', 'battery-full', 'battery-half', 'bandage', 'bandage-outline'
  ],
  Languages: [
    'language', 'globe', 'globe-outline', 'earth', 'earth-outline',
    'map', 'map-outline', 'flag', 'flag-outline', 'location', 'location-outline',
    'navigate', 'navigate-outline', 'compass', 'compass-outline', 'pin', 'pin-outline',
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
    'calculator', 'receipt', 'receipt-outline', 'pricetag', 'pricetag-outline'
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
    'barbell', 'barbell-outline', 'dumbbell', 'fitness', 'fitness-outline',
    'basketball', 'basketball-outline', 'football', 'football-outline',
    'tennis-ball', 'tennis-ball-outline', 'baseball', 'baseball-outline',
    'bicycle', 'bicycle-outline', 'walk', 'walk-outline', 'body', 'body-outline',
    'trophy', 'trophy-outline', 'medal', 'medal-outline', 'ribbon', 'ribbon-outline',
    'disc', 'american-football', 'golf', 'golf-outline'
  ],
  Transport: [
    'car', 'car-outline', 'car-sport', 'car-sport-outline', 'bus', 'bus-outline',
    'train', 'train-outline', 'subway', 'airplane', 'airplane-outline',
    'boat', 'boat-outline', 'bicycle', 'bicycle-outline',
    'rocket', 'rocket-outline', 'navigate', 'navigate-outline',
    'speedometer', 'speedometer-outline', 'map', 'map-outline'
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
    'flower', 'flower-outline', 'rose', 'rose-outline', 'leaf', 'leaf-outline',
    'water', 'water-outline', 'flame', 'flame-outline', 'flash', 'flash-outline',
    'umbrella', 'umbrella-outline', 'planet', 'planet-outline'
  ],
  Fun: [
    'game-controller', 'game-controller-outline', 'dice', 'dice-outline',
    'trophy', 'trophy-outline', 'medal', 'medal-outline', 'ribbon', 'ribbon-outline',
    'star', 'star-outline', 'star-half', 'star-half-outline',
    'flame', 'flame-outline', 'diamond', 'diamond-outline',
    'shield', 'shield-outline', 'skull', 'skull-outline',
    'happy', 'happy-outline', 'heart', 'heart-outline', 'sparkles', 'sparkles-outline'
  ],
};

const COLORS = [
  // Reds
  '#EF4444', '#DC2626', '#B91C1C', '#F87171',
  // Oranges
  '#F97316', '#EA580C', '#C2410C', '#FB923C',
  // Yellows
  '#EAB308', '#CA8A04', '#A16207', '#FACC15',
  // Greens
  '#22C55E', '#16A34A', '#15803D', '#4ADE80',
  // Teals
  '#14B8A6', '#0D9488', '#0F766E', '#2DD4BF',
  // Blues
  '#3B82F6', '#2563EB', '#1D4ED8', '#60A5FA',
  // Purples
  '#8B5CF6', '#7C3AED', '#6D28D9', '#A78BFA',
  // Pinks
  '#EC4899', '#DB2777', '#BE185D', '#F472B6',
  // Neutrals
  '#64748B', '#475569', '#334155', '#94A3B8',
];

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
  const [useEmoji, setUseEmoji] = useState(false);
  const [emojiInput, setEmojiInput] = useState('');
  const [activeCategory, setActiveCategory] = useState('Education');

  useEffect(() => {
    if (visible) {
      setSelectedIcon(currentMetadata?.icon);
      setSelectedColor(currentMetadata?.color);
      const isEmoji = currentMetadata?.icon && currentMetadata.icon.length <= 2 && !/^[a-z-]+$/.test(currentMetadata.icon);
      setUseEmoji(isEmoji || false);
      setEmojiInput(isEmoji && currentMetadata?.icon ? currentMetadata.icon : '');
      setActiveCategory('Education');
    }
  }, [visible, currentMetadata]);

  const categoryIcons = ICON_CATEGORIES[activeCategory as keyof typeof ICON_CATEGORIES] || [];

  const handleSave = () => {
    onSave({
      icon: useEmoji && emojiInput ? emojiInput : selectedIcon,
      color: selectedColor,
    });
    onClose();
  };

  const handleClear = () => {
    onSave({ icon: undefined, color: undefined });
    onClose();
  };

  const displayIcon = useEmoji && emojiInput ? emojiInput : selectedIcon;
  const isEmojiDisplay = displayIcon && displayIcon.length <= 2 && !/^[a-z-]+$/.test(displayIcon);

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
              <Pressable onPress={onClose} style={styles.closeButton}>
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
              {displayIcon && (
                isEmojiDisplay ? (
                  <Text style={styles.previewEmoji}>{displayIcon}</Text>
                ) : (
                  <Ionicons name={displayIcon as any} size={32} color={selectedColor || theme.colors.accent} />
                )
              )}
              <View style={{ flex: 1 }}>
                <Text style={[styles.previewName, { color: theme.colors.textPrimary }]} numberOfLines={1}>
                  {deckName}
                </Text>
                <Text style={[styles.previewHint, { color: theme.colors.textSecondary }]}>
                  {displayIcon || selectedColor ? 'Preview' : 'Select icon & color below'}
                </Text>
              </View>
            </View>
          </View>

          {/* Scrollable Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Icon/Emoji Toggle */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Icon</Text>
              <View style={styles.segmentControl}>
                <Pressable
                  style={[
                    styles.segment,
                    !useEmoji && { backgroundColor: theme.colors.accent },
                  ]}
                  onPress={() => setUseEmoji(false)}
                >
                  <Text style={[
                    styles.segmentText,
                    { color: !useEmoji ? '#FFF' : theme.colors.textSecondary }
                  ]}>
                    Icons
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.segment,
                    useEmoji && { backgroundColor: theme.colors.accent },
                  ]}
                  onPress={() => setUseEmoji(true)}
                >
                  <Text style={[
                    styles.segmentText,
                    { color: useEmoji ? '#FFF' : theme.colors.textSecondary }
                  ]}>
                    Emoji
                  </Text>
                </Pressable>
              </View>
            </View>

            {useEmoji ? (
              /* Emoji Input */
              <View style={styles.section}>
                <TextInput
                  style={[
                    styles.emojiInput,
                    { 
                      backgroundColor: theme.colors.bg,
                      color: theme.colors.textPrimary,
                      borderColor: theme.colors.border,
                    }
                  ]}
                  placeholder="Type or paste emoji (e.g., 📚)"
                  placeholderTextColor={theme.colors.textSecondary}
                  value={emojiInput}
                  onChangeText={(text) => {
                    if (text.length <= 2) setEmojiInput(text);
                  }}
                  maxLength={2}
                  autoFocus
                />
              </View>
            ) : (
              /* Icon Categories */
              <>
                {/* Category Tabs */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  style={styles.categoryScroll}
                  contentContainerStyle={styles.categoryContent}
                >
                  {Object.keys(ICON_CATEGORIES).map((category) => (
                    <Pressable
                      key={category}
                      style={[
                        styles.categoryTab,
                        { 
                          backgroundColor: activeCategory === category 
                            ? theme.colors.accent + '20' 
                            : 'transparent',
                          borderColor: activeCategory === category 
                            ? theme.colors.accent 
                            : theme.colors.border,
                        }
                      ]}
                      onPress={() => setActiveCategory(category)}
                    >
                      <Text style={[
                        styles.categoryText,
                        { color: activeCategory === category ? theme.colors.accent : theme.colors.textSecondary }
                      ]}>
                        {category}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Icon Grid */}
                <View style={styles.iconGrid}>
                  {categoryIcons.map((icon) => (
                    <Pressable
                      key={icon}
                      style={[
                        styles.iconButton,
                        {
                          backgroundColor: selectedIcon === icon 
                            ? theme.colors.accent + '20'
                            : theme.colors.bg,
                          borderColor: selectedIcon === icon
                            ? theme.colors.accent
                            : theme.colors.border,
                        }
                      ]}
                      onPress={() => setSelectedIcon(selectedIcon === icon ? undefined : icon)}
                    >
                      <Ionicons 
                        name={icon as any} 
                        size={22} 
                        color={selectedIcon === icon ? theme.colors.accent : theme.colors.textPrimary} 
                      />
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Color Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>Color</Text>
              <View style={styles.colorRow}>
                {COLORS.map((color) => (
                  <Pressable
                    key={color}
                    style={[
                      styles.colorButton,
                      { backgroundColor: color },
                      selectedColor === color && styles.colorSelected,
                    ]}
                    onPress={() => setSelectedColor(selectedColor === color ? undefined : color)}
                  >
                    {selectedColor === color && (
                      <Ionicons name="checkmark" size={18} color="#FFF" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ height: 200 }} />
          </ScrollView>

          {/* Sticky Footer */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Pressable
              style={[styles.button, { backgroundColor: theme.colors.bg }]}
              onPress={handleClear}
            >
              <Text style={[styles.buttonText, { color: theme.colors.textSecondary }]}>
                Clear All
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
    maxHeight: '92%',
    height: '92%',
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
    marginBottom: s.md,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  closeButton: {
    padding: s.xs,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: s.md,
    borderRadius: r.lg,
    borderWidth: 2,
    gap: s.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewEmoji: {
    fontSize: 28,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewHint: {
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: s.lg,
  },
  section: {
    marginTop: s.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: s.sm,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: r.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: s.sm,
    borderRadius: r.sm,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emojiInput: {
    fontSize: 24,
    textAlign: 'center',
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    height: 56,
  },
  searchInput: {
    fontSize: 15,
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
  },
  categoryScroll: {
    marginTop: s.md,
  },
  categoryContent: {
    gap: s.sm,
    paddingRight: s.lg,
  },
  categoryTab: {
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.full,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.sm,
    marginTop: s.md,
  },
  iconButton: {
    width: (width - s.lg * 2 - s.sm * 5) / 6,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: r.md,
    borderWidth: 1.5,
  },
  colorRow: {
    flexDirection: 'row',
    gap: s.sm,
    flexWrap: 'wrap',
  },
  colorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  customColor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: s.md,
    gap: s.sm,
  },
  hexInput: {
    flex: 1,
    fontSize: 14,
    padding: s.sm,
    paddingHorizontal: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    fontFamily: 'monospace',
  },
  colorPreview: {
    width: 36,
    height: 36,
    borderRadius: r.sm,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  footer: {
    flexDirection: 'row',
    padding: s.lg,
    gap: s.md,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: s.md,
    borderRadius: r.md,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
