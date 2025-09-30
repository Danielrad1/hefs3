import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface DeckNode {
  deck: { id: string; name: string; cardCount: number; dueCount: number };
  children: DeckNode[];
  level: number;
}

export default function DecksScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { decks, currentDeckId, setDeck } = useScheduler();
  const [expandedDecks, setExpandedDecks] = React.useState<Set<string>>(new Set());

  // Log decks whenever they change
  React.useEffect(() => {
    console.log('[DecksScreen] Received', decks.length, 'decks from scheduler:');
    decks.forEach(d => {
      console.log('[DecksScreen] -', d.name, ':', d.cardCount, 'cards,', d.dueCount, 'due');
    });
  }, [decks]);

  const handleDeckPress = (deckId: string) => {
    setDeck(deckId);
    // Navigate to Study screen
    navigation.navigate('Study' as never);
  };

  const handleAllDecks = () => {
    setDeck(null);  // null = all decks
    navigation.navigate('Study' as never);
  };

  // Build tree structure from flat deck list
  const buildDeckTree = React.useMemo(() => {
    const tree: DeckNode[] = [];
    const deckMap = new Map<string, DeckNode>();

    // Sort decks by name to process parents before children
    const sortedDecks = [...decks].sort((a, b) => a.name.localeCompare(b.name));

    sortedDecks.forEach(deck => {
      const parts = deck.name.split('::');
      const node: DeckNode = {
        deck: { ...deck }, // Clone so we can update stats
        children: [],
        level: parts.length - 1,
      };

      deckMap.set(deck.name, node);

      if (parts.length === 1) {
        // Root level deck
        tree.push(node);
      } else {
        // Child deck - find parent
        const parentName = parts.slice(0, -1).join('::');
        const parent = deckMap.get(parentName);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent doesn't exist, add as root
          tree.push(node);
        }
      }
    });

    // Calculate cumulative stats for parent decks (bottom-up)
    const calculateStats = (node: DeckNode): { cardCount: number; dueCount: number } => {
      if (node.children.length === 0) {
        // Leaf node - use its own stats
        return {
          cardCount: node.deck.cardCount,
          dueCount: node.deck.dueCount,
        };
      }

      // Parent node - sum all children
      let totalCards = node.deck.cardCount; // Start with own cards
      let totalDue = node.deck.dueCount;

      node.children.forEach(child => {
        const childStats = calculateStats(child);
        totalCards += childStats.cardCount;
        totalDue += childStats.dueCount;
      });

      // Update parent's stats to reflect children
      node.deck.cardCount = totalCards;
      node.deck.dueCount = totalDue;

      return { cardCount: totalCards, dueCount: totalDue };
    };

    // Calculate stats for all trees
    tree.forEach(node => calculateStats(node));

    return tree;
  }, [decks]);

  const toggleExpand = (deckName: string) => {
    setExpandedDecks(prev => {
      const next = new Set(prev);
      if (next.has(deckName)) {
        next.delete(deckName);
      } else {
        next.add(deckName);
      }
      return next;
    });
  };

  const totalDue = decks.reduce((sum, d) => sum + d.dueCount, 0);
  const totalCards = decks.reduce((sum, d) => sum + d.cardCount, 0);

  // Render deck node recursively
  const renderDeckNode = (nodes: DeckNode[], parentLevel: number): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];

    nodes.forEach((node) => {
      const parts = node.deck.name.split('::');
      const leafName = parts[parts.length - 1];
      const hasChildren = node.children.length > 0;
      const isExpanded = expandedDecks.has(node.deck.name);
      const indent = node.level * 20;

      elements.push(
        <Pressable
          key={node.deck.id}
          style={[
            styles.deckCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: currentDeckId === node.deck.id ? theme.colors.accent : 'transparent',
              borderWidth: 2,
              marginLeft: indent,
            },
          ]}
          onPress={() => {
            if (hasChildren) {
              toggleExpand(node.deck.name);
            } else {
              handleDeckPress(node.deck.id);
            }
          }}
        >
          <View style={styles.deckInfo}>
            {hasChildren && (
              <Text style={[styles.expandIcon, { color: theme.colors.textSecondary }]}>
                {isExpanded ? '▼' : '▶'}
              </Text>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.deckName, { color: theme.colors.textPrimary }]}>
                {leafName}
              </Text>
            </View>
            <Text style={[styles.cardCount, { color: theme.colors.textSecondary }]}>
              {node.deck.dueCount} due · {node.deck.cardCount} total
            </Text>
          </View>
        </Pressable>
      );

      // Render children if expanded
      if (isExpanded && hasChildren) {
        elements.push(...renderDeckNode(node.children, node.level + 1));
      }
    });

    return elements;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Choose a Deck
        </Text>

        {/* All Decks option */}
        <Pressable
          style={[
            styles.deckCard,
            { 
              backgroundColor: theme.colors.surface,
              borderColor: currentDeckId === null ? theme.colors.accent : 'transparent',
              borderWidth: 2,
            }
          ]}
          onPress={handleAllDecks}
        >
          <Text style={[styles.deckName, { color: theme.colors.textPrimary }]}>
            All Decks
          </Text>
          <Text style={[styles.cardCount, { color: theme.colors.textSecondary }]}>
            {totalDue} due · {totalCards} total
          </Text>
        </Pressable>

        {/* Render deck tree */}
        {renderDeckNode(buildDeckTree, 0)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    gap: s.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: s.md,
  },
  deckCard: {
    padding: s.md,
    borderRadius: r.md,
    marginBottom: s.xs,
  },
  deckInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  expandIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  deckName: {
    fontSize: 16,
    fontWeight: '600',
  },
  deckPath: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  cardCount: {
    fontSize: 13,
  },
});
