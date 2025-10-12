import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import { DeckMetadata } from '../../../services/anki/DeckMetadataService';

interface DeckWithStats {
  id: string;
  name: string;
  cardCount: number;
  dueCount: number;
}

interface DeckCardProps {
  deck: DeckWithStats;
  level: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isCurrentDeck: boolean;
  metadata?: DeckMetadata | null;
  onPress: () => void;
  onLongPress: () => void;
  onMorePress: () => void;
}

export default function DeckCard({
  deck,
  level,
  hasChildren,
  isExpanded,
  isCurrentDeck,
  metadata,
  onPress,
  onLongPress,
  onMorePress,
}: DeckCardProps) {
  const theme = useTheme();
  const parts = deck.name.split('::');
  const leafName = parts[parts.length - 1];
  const indent = level * 20;

  const customColor = metadata?.color;
  const customIcon = metadata?.icon;
  const isEmoji = customIcon && (customIcon.length <= 2 && !/^[a-z-]+$/.test(customIcon));

  // Generate gradient colors
  const gradientColors = customColor 
    ? [customColor + '30', customColor + '05'] as const
    : null;

  const cardContent = (
    <>
      <View style={styles.deckHeader}>
        <View style={styles.deckTitleRow}>
          {/* Chevron for hierarchical decks - ALWAYS show if hasChildren */}
          {hasChildren && (
            <Ionicons 
              name={isExpanded ? 'chevron-down' : 'chevron-forward'} 
              size={16} 
              color={theme.colors.textSecondary}
              style={styles.expandIcon}
            />
          )}
          
          {/* Tree Badge for Anki hierarchical decks */}
          {hasChildren && !customIcon && (
            <View style={[styles.treeBadge, { backgroundColor: theme.colors.accent + '20' }]}>
              <Ionicons name="git-network" size={16} color={theme.colors.accent} />
            </View>
          )}
          
          {/* Custom Icon (separate from chevron and tree badge) */}
          {customIcon && (
            isEmoji ? (
              <Text style={styles.emoji}>{customIcon}</Text>
            ) : (
              <Ionicons name={customIcon as any} size={28} color={customColor || theme.colors.accent} />
            )
          )}
          
          <View style={{ flex: 1 }}>
            {metadata?.folder && (
              <Text style={[styles.folderPath, { color: theme.colors.textSecondary }]}>
                {metadata.folder}
              </Text>
            )}
            <Text 
              style={[
                styles.deckName, 
                { color: theme.colors.textPrimary }
              ]}
              numberOfLines={1}
            >
              {leafName}
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.moreButton}
          onPress={onMorePress}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.textSecondary} />
        </Pressable>
      </View>
      
      <View style={styles.deckStats}>
        <Text style={[styles.statText, { color: theme.colors.accent }]}>
          {deck.dueCount} due
        </Text>
        <Text style={[styles.statDivider, { color: theme.colors.textSecondary }]}>•</Text>
        <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
          {deck.cardCount} cards
        </Text>
      </View>
    </>
  );

  if (customColor && gradientColors) {
    return (
      <Pressable
        style={[styles.deckCard, { marginLeft: indent, overflow: 'hidden' }]}
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
        styles.deckCard,
        {
          backgroundColor: theme.colors.surface,
          marginLeft: indent,
          borderLeftWidth: isCurrentDeck ? 4 : 0,
          borderLeftColor: theme.colors.accent,
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
  deckCard: {
    padding: s.lg,
    borderRadius: r.lg,
    marginBottom: s.md,
  },
  deckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: s.md,
  },
  deckTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    flex: 1,
  },
  emoji: {
    fontSize: 28,
  },
  expandIcon: {
    marginRight: 4,
  },
  treeBadge: {
    width: 32,
    height: 32,
    borderRadius: r.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderPath: {
    fontSize: 11,
    marginBottom: 2,
    opacity: 0.7,
  },
  deckName: {
    fontSize: 18,
    fontWeight: '600',
  },
  moreButton: {
    padding: s.xs,
  },
  deckStats: {
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
