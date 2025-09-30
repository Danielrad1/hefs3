import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

export default function DecksScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { decks, currentDeckId, setDeck } = useScheduler();

  const handleDeckPress = (deckId: string) => {
    setDeck(deckId);
    // Navigate to Study screen
    navigation.navigate('Study' as never);
  };

  const handleAllDecks = () => {
    setDeck(null);  // null = all decks
    navigation.navigate('Study' as never);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
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
            {decks.reduce((sum, d) => sum + d.dueCount, 0)} due · {decks.reduce((sum, d) => sum + d.cardCount, 0)} total
          </Text>
        </Pressable>

        {/* Individual decks */}
        {decks.map((deck) => (
          <Pressable
            key={deck.id}
            style={[
              styles.deckCard,
              { 
                backgroundColor: theme.colors.surface,
                borderColor: currentDeckId === deck.id ? theme.colors.accent : 'transparent',
                borderWidth: 2,
              }
            ]}
            onPress={() => handleDeckPress(deck.id)}
          >
            <Text style={[styles.deckName, { color: theme.colors.textPrimary }]}>
              {deck.name}
            </Text>
            <Text style={[styles.cardCount, { color: theme.colors.textSecondary }]}>
              {deck.dueCount} due · {deck.cardCount} total
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
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
    padding: s.xl,
    borderRadius: r.lg,
    gap: s.xs,
  },
  deckName: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardCount: {
    fontSize: 14,
  },
});
