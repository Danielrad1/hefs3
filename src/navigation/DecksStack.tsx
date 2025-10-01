import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DecksScreen from '../app/Decks/DecksScreen';
import DeckDetailScreen from '../app/Decks/DeckDetailScreen';
import CardBrowserScreen from '../app/Browser/CardBrowserScreen';
import NoteEditorScreen from '../app/Editor/NoteEditorScreen';

const Stack = createNativeStackNavigator();

export default function DecksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DecksList" component={DecksScreen} />
      <Stack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <Stack.Screen name="DeckBrowser" component={CardBrowserScreen} />
      <Stack.Screen name="NoteEditor" component={NoteEditorScreen} />
    </Stack.Navigator>
  );
}
