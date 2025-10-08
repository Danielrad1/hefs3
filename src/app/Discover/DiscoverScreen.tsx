/**
 * DiscoverScreen - Browse curated flashcard decks
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
    color: '#6EE7F2',
  },
  {
    id: 'japanese-hiragana',
    name: 'Japanese Hiragana',
    description: 'Master all 46 Hiragana characters with examples',
    cardCount: 92,
    category: 'Languages',
    difficulty: 'Beginner',
    icon: 'book',
    color: '#FF6B9D',
  },
  {
    id: 'medical-terminology',
    name: 'Medical Terminology',
    description: 'Common medical terms, prefixes, and suffixes',
    cardCount: 350,
    category: 'Medicine',
    difficulty: 'Advanced',
    icon: 'medical',
    color: '#4ECDC4',
  },
  {
    id: 'javascript-basics',
    name: 'JavaScript Fundamentals',
    description: 'Core JavaScript concepts and syntax',
    cardCount: 200,
    category: 'Programming',
    difficulty: 'Intermediate',
    icon: 'code-slash',
    color: '#F7B731',
  },
  {
    id: 'anatomy-bones',
    name: 'Human Anatomy: Bones',
    description: 'All 206 bones in the human skeleton',
    cardCount: 206,
    category: 'Medicine',
    difficulty: 'Advanced',
    icon: 'body',
    color: '#A55EEA',
  },
  {
    id: 'french-verbs',
    name: 'French Verb Conjugations',
    description: 'Common French verbs and their conjugations',
    cardCount: 150,
    category: 'Languages',
    difficulty: 'Intermediate',
    icon: 'language',
    color: '#45AAF2',
  },
  {
    id: 'capitals-world',
    name: 'World Capitals',
    description: 'Capital cities of every country',
    cardCount: 195,
    category: 'Geography',
    difficulty: 'Beginner',
    icon: 'earth',
    color: '#26DE81',
  },
  {
    id: 'sat-vocabulary',
    name: 'SAT Vocabulary',
    description: 'High-frequency SAT words with definitions',
    cardCount: 500,
    category: 'Education',
    difficulty: 'Intermediate',
    icon: 'school',
    color: '#FD79A8',
  },
];

export default function DiscoverScreen() {
  const theme = useTheme();

  const handleDeckPress = (deck: CuratedDeck) => {
    Alert.alert(
      'Download Unavailable',
      `"${deck.name}" looks great!\n\nDeck downloads will be available in a future update when cloud storage is implemented.`,
      [{ text: 'OK' }]
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner':
        return '#26DE81';
      case 'Intermediate':
        return '#F7B731';
      case 'Advanced':
        return '#FC5C65';
      default:
        return theme.colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>Discover</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Explore curated flashcard decks
        </Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {CURATED_DECKS.map((deck) => (
            <Pressable
              key={deck.id}
              style={[styles.card, { backgroundColor: theme.colors.surface }]}
              onPress={() => handleDeckPress(deck)}
            >
              <View style={[styles.iconContainer, { backgroundColor: deck.color + '20' }]}>
                <Ionicons name={deck.icon} size={32} color={deck.color} />
              </View>

              <View style={styles.cardContent}>
                <Text style={[styles.deckName, { color: theme.colors.textPrimary }]} numberOfLines={2}>
                  {deck.name}
                </Text>
                <Text style={[styles.deckDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                  {deck.description}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.metaRow}>
                    <Ionicons name="layers-outline" size={14} color={theme.colors.textTertiary} />
                    <Text style={[styles.metaText, { color: theme.colors.textTertiary }]}>
                      {deck.cardCount} cards
                    </Text>
                  </View>

                  <View style={[styles.difficultyBadge, { backgroundColor: getDifficultyColor(deck.difficulty) + '20' }]}>
                    <Text style={[styles.difficultyText, { color: getDifficultyColor(deck.difficulty) }]}>
                      {deck.difficulty}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={20} color={theme.colors.textTertiary} />
          <Text style={[styles.footerText, { color: theme.colors.textTertiary }]}>
            Downloads coming soon
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: s.lg,
    paddingTop: s.md,
    paddingBottom: s.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E20',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: s.xs,
  },
  subtitle: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  grid: {
    padding: s.md,
    gap: s.md,
  },
  card: {
    borderRadius: r.lg,
    padding: s.lg,
    marginBottom: s.md,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: s.md,
  },
  cardContent: {
    gap: s.xs,
  },
  deckName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: s.xs,
  },
  deckDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: s.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs,
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
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    paddingVertical: s.xl,
  },
  footerText: {
    fontSize: 14,
  },
});
