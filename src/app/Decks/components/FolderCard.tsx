import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import { FolderMetadata } from '../../../services/anki/DeckMetadataService';

interface FolderCardProps {
  folderName: string;
  metadata?: FolderMetadata | null;
  deckCount: number;
  totalCards: number;
  dueCards: number;
  isExpanded: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMorePress: () => void;
}

export default function FolderCard({
  folderName,
  metadata,
  deckCount,
  totalCards,
  dueCards,
  isExpanded,
  onPress,
  onLongPress,
  onMorePress,
}: FolderCardProps) {
  const theme = useTheme();

  const customColor = metadata?.color;
  const customIcon = metadata?.icon;
  const isEmoji = customIcon && (customIcon.length <= 2 && !/^[a-z-]+$/.test(customIcon));

  // Generate gradient colors
  const gradientColors = customColor 
    ? [customColor + '30', customColor + '05'] as const
    : null;

  const cardContent = (
    <>
      <View style={styles.folderHeader}>
        <View style={styles.folderTitleRow}>
          {/* Chevron on the left */}
          <Ionicons 
            name={isExpanded ? 'chevron-down' : 'chevron-forward'} 
            size={16} 
            color={theme.colors.textSecondary}
            style={styles.expandIcon}
          />
          
          {/* Folder Icon - with badge only if has custom color */}
          {!customIcon && (
            customColor ? (
              <View style={[styles.folderBadge, { backgroundColor: customColor + '20' }]}>
                <Ionicons 
                  name={isExpanded ? 'folder-open' : 'folder'} 
                  size={16} 
                  color={customColor}
                />
              </View>
            ) : (
              <Ionicons 
                name={isExpanded ? 'folder-open' : 'folder'} 
                size={24} 
                color={theme.colors.accent}
              />
            )
          )}
          
          {/* Custom Icon */}
          {customIcon && (
            isEmoji ? (
              <Text style={styles.emoji}>{customIcon}</Text>
            ) : (
              <Ionicons name={customIcon as any} size={24} color={customColor || theme.colors.accent} />
            )
          )}
          
          <View style={{ flex: 1 }}>
            <Text 
              style={[
                styles.folderName, 
                { color: theme.colors.textPrimary }
              ]}
              numberOfLines={1}
            >
              {folderName}
            </Text>
          </View>
        </View>

        {/* 3-dot menu button */}
        <Pressable
          style={styles.moreButton}
          onPress={onMorePress}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.folderStats}>
        <Text style={[styles.statText, { color: theme.colors.accent }]}>
          {dueCards} due
        </Text>
        <Text style={[styles.statDivider, { color: theme.colors.textSecondary }]}>•</Text>
        <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
          {totalCards} cards
        </Text>
        <Text style={[styles.statDivider, { color: theme.colors.textSecondary }]}>•</Text>
        <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
          {deckCount} {deckCount === 1 ? 'deck' : 'decks'}
        </Text>
      </View>
    </>
  );

  if (customColor && gradientColors) {
    return (
      <Pressable
        style={[styles.folderCard, { overflow: 'hidden' }]}
        onPress={onPress}
        onLongPress={onLongPress}
      >
        <LinearGradient
          colors={[...gradientColors]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {cardContent}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[
        styles.folderCard,
        {
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {cardContent}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  folderCard: {
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.md,
  },
  folderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.md,
  },
  folderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    flex: 1,
  },
  expandIcon: {
    marginRight: 4,
  },
  folderBadge: {
    width: 32,
    height: 32,
    borderRadius: r.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 24,
  },
  folderName: {
    fontSize: 18,
    fontWeight: '700',
  },
  moreButton: {
    padding: s.xs,
  },
  folderStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    marginTop: s.xs,
  },
  statText: {
    fontSize: 13,
    fontWeight: '500',
  },
  statDivider: {
    fontSize: 13,
    opacity: 0.5,
  },
});
