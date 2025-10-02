import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

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
  onPress,
  onLongPress,
  onMorePress,
}: DeckCardProps) {
  const theme = useTheme();
  const parts = deck.name.split('::');
  const leafName = parts[parts.length - 1];
  const indent = level * 20;

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
      <View style={styles.deckHeader}>
        <View style={styles.deckTitleRow}>
          {hasChildren && (
            <Ionicons 
              name={isExpanded ? 'chevron-down' : 'chevron-forward'} 
              size={16} 
              color={theme.colors.textSecondary}
              style={styles.expandIcon}
            />
          )}
          <Text style={[styles.deckName, { color: theme.colors.textPrimary }]}>
            {leafName}
          </Text>
        </View>
        <Pressable
          style={styles.moreButton}
          onPress={onMorePress}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.textSecondary} />
        </Pressable>
      </View>
      
      <View style={styles.deckStats}>
        <View style={styles.statBadge}>
          <Text style={[styles.statNumber, { color: theme.colors.accent }]}>
            {deck.dueCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            due
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBadge}>
          <Text style={[styles.statNumber, { color: theme.colors.textPrimary }]}>
            {deck.cardCount}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
            total
          </Text>
        </View>
      </View>
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
  expandIcon: {
    marginRight: 4,
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
    gap: s.md,
  },
  statBadge: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: s.xs / 2,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
});
