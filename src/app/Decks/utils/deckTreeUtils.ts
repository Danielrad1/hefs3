export interface DeckWithStats {
  id: string;
  name: string;
  cardCount: number;
  dueCount: number;
}

export interface DeckNode {
  deck: DeckWithStats;
  level: number;
  children: DeckNode[];
}

/**
 * Build a hierarchical tree structure from a flat list of decks
 * Handles nested decks using :: separator
 */
export function buildDeckTree(decks: DeckWithStats[]): DeckNode[] {
  const tree: DeckNode[] = [];
  const deckMap = new Map<string, DeckNode>();

  // Filter out Default deck and sort by name
  const sortedDecks = [...decks]
    .filter(d => d.id !== '1' && d.name !== 'Default')
    .sort((a, b) => a.name.localeCompare(b.name));

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
}

/**
 * Filter decks by search query
 */
export function filterDecks(decks: DeckWithStats[], query: string): DeckWithStats[] {
  if (!query.trim()) return decks;
  const lowerQuery = query.toLowerCase();
  return decks.filter(d => d.name.toLowerCase().includes(lowerQuery));
}
