import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DiscoverScreen from '../app/Discover/DiscoverScreen';
import CategoryDecksScreen from '../app/Discover/CategoryDecksScreen';
import { DeckManifest } from '../services/discover/DiscoverService';

export type DiscoverStackParamList = {
  DiscoverHome: undefined;
  CategoryDecks: { category: string; decks: DeckManifest[] };
};

const Stack = createNativeStackNavigator<DiscoverStackParamList>();

export default function DiscoverStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DiscoverHome" component={DiscoverScreen} />
      <Stack.Screen name="CategoryDecks" component={CategoryDecksScreen} />
    </Stack.Navigator>
  );
}
