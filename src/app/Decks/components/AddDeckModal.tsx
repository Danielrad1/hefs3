import React from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface AddDeckModalProps {
  visible: boolean;
  onCreateNew: () => void;
  onImport: () => void;
  onCancel: () => void;
}

export default function AddDeckModal({
  visible,
  onCreateNew,
  onImport,
  onCancel,
}: AddDeckModalProps) {
  const theme = useTheme();
  const slideAnim = React.useRef(new Animated.Value(300)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable 
        style={styles.modalOverlay}
        onPress={onCancel}
      >
        <Animated.View 
          style={[
            styles.bottomSheet, 
            { 
              backgroundColor: theme.colors.surface,
              transform: [{ translateY: slideAnim }],
            }
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle bar */}
          <View style={styles.handleBar}>
            <View style={[styles.handle, { backgroundColor: theme.colors.textTertiary }]} />
          </View>

          <Text style={[styles.sheetTitle, { color: theme.colors.textPrimary }]}>
            Add Deck
          </Text>
          
          <Pressable
            style={[styles.sheetOption, { borderBottomColor: theme.colors.border }]}
            onPress={onCreateNew}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.accent + '15' }]}>
              <Ionicons name="create-outline" size={24} color={theme.colors.accent} />
            </View>
            <View style={styles.sheetOptionText}>
              <Text style={[styles.sheetOptionTitle, { color: theme.colors.textPrimary }]}>
                Create New Deck
              </Text>
              <Text style={[styles.sheetOptionDesc, { color: theme.colors.textSecondary }]}>
                Start with an empty deck
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </Pressable>

          <Pressable
            style={styles.sheetOption}
            onPress={onImport}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.accent + '15' }]}>
              <Ionicons name="download-outline" size={24} color={theme.colors.accent} />
            </View>
            <View style={styles.sheetOptionText}>
              <Text style={[styles.sheetOptionTitle, { color: theme.colors.textPrimary }]}>
                Import .apkg File
              </Text>
              <Text style={[styles.sheetOptionDesc, { color: theme.colors.textSecondary }]}>
                Import an Anki deck file
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.textTertiary} />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    paddingBottom: s.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: s.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  sheetTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: s.lg,
    paddingHorizontal: s.lg,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    paddingVertical: s.lg,
    paddingHorizontal: s.lg,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetOptionText: {
    flex: 1,
    gap: s.xs / 2,
  },
  sheetOptionTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  sheetOptionDesc: {
    fontSize: 14,
  },
});
