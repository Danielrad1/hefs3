import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../design/theme';
import { useScheduler } from '../../context/SchedulerProvider';
import { sampleCards } from '../../mocks/sampleCards';
import { db } from '../../services/anki/InMemoryDb';

export default function HomeScreen() {
  const t = useTheme();
  const { bootstrap } = useScheduler();

  // Bootstrap sample data ONLY on first launch (empty database)
  useEffect(() => {
    const allCards = db.getAllCards();
    if (allCards.length === 0) {
      console.log('[HomeScreen] First launch - loading sample decks');
      bootstrap(sampleCards);
    } else {
      console.log('[HomeScreen] Database has', allCards.length, 'cards');
    }
  }, [bootstrap]);

  return (
    <View style={{
      flex: 1,
      backgroundColor: t.colors.bg,
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Text style={{ color: t.colors.textPrimary }}>Home / Stats</Text>
    </View>
  );
}
