import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface CuratedDeck {
  id: string;
  name: string;
  description: string;
  cardCount: number;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const CURATED_DECKS: CuratedDeck[] = [
  {
    id: 'spanish-basic',
    name: 'Spanish Basics',
    description: 'Essential Spanish vocabulary and phrases for beginners',
    cardCount: 500,
    category: 'Languages',
    difficulty: 'Beginner',
    icon: 'language',
    color: '#FF6B6B',
  },
  {
    id: 'japanese-hiragana',
    name: 'Japanese Hiragana',
    description: 'Master the Japanese Hiragana writing system',
    cardCount: 92,
    category: 'Languages',
    difficulty: 'Beginner',
    icon: 'text',
    color: '#E84393',
  },
  {
    id: 'world-capitals',
    name: 'World Capitals',
    description: 'Learn all capital cities of the world',
    cardCount: 195,
    category: 'Geography',
    difficulty: 'Intermediate',
    icon: 'globe',
    color: '#4ECDC4',
  },
  {
    id: 'periodic-table',
    name: 'Periodic Table',
    description: 'Chemical elements, symbols, and atomic numbers',
    cardCount: 118,
    category: 'Science',
    difficulty: 'Intermediate',
    icon: 'flask',
    color: '#A29BFE',
  },
  {
    id: 'human-anatomy',
    name: 'Human Anatomy',
    description: 'Major bones, muscles, and organs of the human body',
    cardCount: 350,
    category: 'Medicine',
    difficulty: 'Advanced',
    icon: 'medical',
    color: '#FD79A8',
  },
  {
    id: 'programming-terms',
    name: 'Programming Concepts',
    description: 'Essential computer science and programming terminology',
    cardCount: 200,
    category: 'Technology',
    difficulty: 'Intermediate',
    icon: 'code-slash',
    color: '#6C5CE7',
  },
  {
    id: 'us-history',
    name: 'US History Timeline',
    description: 'Key events and dates in American history',
    cardCount: 300,
    category: 'History',
    difficulty: 'Intermediate',
    icon: 'time',
    color: '#FDCB6E',
  },
  {
    id: 'medical-terms',
    name: 'Medical Terminology',
    description: 'Common medical prefixes, suffixes, and root words',
    cardCount: 450,
    category: 'Medicine',
    difficulty: 'Advanced',
    icon: 'fitness',
    color: '#00B894',
  },
];

const CATEGORIES = ['All', 'Languages', 'Science', 'Geography', 'Medicine', 'History', 'Technology'];

export default function DiscoverScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [selectedCategory, setSelectedCategory] = React.useState('All');

  const filteredDecks = selectedCategory === 'All' 
    ? CURATED_DECKS 
    : CURATED_DECKS.filter(deck => deck.category === selectedCategory);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return '#00B894';
      case 'Intermediate': return '#FDCB6E';
      case 'Advanced': return '#E84393';
      default: return theme.colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Discover
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Curated decks to jumpstart your learning
            </Text>
          </View>
        </View>

        {/* Category Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
          contentContainerStyle={styles.categoryContainer}
        >
          {CATEGORIES.map(category => (
            <Pressable
              key={category}
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === category 
                    ? theme.colors.accent 
                    : theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(category)}
            >
              <Text
                style={[
                  styles.categoryText,
                  {
                    color: selectedCategory === category 
                      ? '#000' 
                      : theme.colors.textPrimary,
                  },
                ]}
              >
                {category}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Deck Cards */}
        <View style={styles.decksContainer}>
          {filteredDecks.map(deck => (
            <Pressable
              key={deck.id}
              style={[styles.deckCard, { backgroundColor: theme.colors.surface }]}
              onPress={() => {
                // TODO: Navigate to deck preview/download screen
                console.log('Deck tapped:', deck.name);
              }}
            >
              <View style={styles.deckCardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: deck.color + '15' }]}>
                  <Ionicons name={deck.icon} size={28} color={deck.color} />
                </View>
                <View style={styles.deckInfo}>
                  <Text style={[styles.deckName, { color: theme.colors.textPrimary }]}>
                    {deck.name}
                  </Text>
                  <View style={styles.deckMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="layers-outline" size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                        {deck.cardCount} cards
                      </Text>
                    </View>
                    <View 
                      style={[
                        styles.difficultyBadge, 
                        { backgroundColor: getDifficultyColor(deck.difficulty) + '15' }
                      ]}
                    >
                      <Text style={[styles.difficultyText, { color: getDifficultyColor(deck.difficulty) }]}>
                        {deck.difficulty}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
              
              <Text style={[styles.deckDescription, { color: theme.colors.textSecondary }]}>
                {deck.description}
              </Text>

              <View style={styles.deckFooter}>
                <View style={[styles.categoryBadge, { backgroundColor: theme.colors.bg }]}>
                  <Text style={[styles.categoryBadgeText, { color: theme.colors.textSecondary }]}>
                    {deck.category}
                  </Text>
                </View>
                <Pressable style={[styles.downloadButton, { backgroundColor: theme.colors.accent }]}>
                  <Ionicons name="download" size={16} color="#000" />
                  <Text style={styles.downloadButtonText}>Get Deck</Text>
                </Pressable>
              </View>
            </Pressable>
          ))}
        </View>

        {filteredDecks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color={theme.colors.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              No decks found in this category
            </Text>
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
  scrollView: {
    flex: 1,
  },
  header: {
    padding: s.lg,
    paddingBottom: s.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: 16,
  },
  categoryScroll: {
    marginBottom: s.lg,
  },
  categoryContainer: {
    paddingHorizontal: s.lg,
    gap: s.sm,
  },
  categoryChip: {
    paddingHorizontal: s.lg,
    paddingVertical: s.sm,
    borderRadius: r.full,
    borderWidth: 1,
    marginRight: s.sm,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  decksContainer: {
    padding: s.lg,
    gap: s.md,
  },
  deckCard: {
    padding: s.lg,
    borderRadius: r.lg,
    gap: s.md,
  },
  deckCardHeader: {
    flexDirection: 'row',
    gap: s.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckInfo: {
    flex: 1,
    gap: s.xs,
  },
  deckName: {
    fontSize: 18,
    fontWeight: '600',
  },
  deckMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs / 2,
  },
  metaText: {
    fontSize: 13,
  },
  difficultyBadge: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs / 2,
    borderRadius: r.sm,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deckDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  deckFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: s.md,
    paddingVertical: s.xs,
    borderRadius: r.sm,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
    paddingHorizontal: s.lg,
    paddingVertical: s.sm,
    borderRadius: r.md,
  },
  downloadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  emptyState: {
    padding: s.xl * 2,
    alignItems: 'center',
    gap: s.md,
  },
  emptyText: {
    fontSize: 16,
  },
});
