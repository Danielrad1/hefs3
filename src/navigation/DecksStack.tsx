import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DecksScreen from '../app/Decks/DecksScreen';
import DeckDetailScreen from '../app/Decks/DeckDetailScreen';
import CardBrowserScreen from '../app/Browser/CardBrowserScreen';
import NoteEditorScreen from '../app/Editor/NoteEditorScreen';
import AIDeckCreatorScreen from '../app/Decks/AIDeckCreatorScreen';
import AIGeneratingScreen from '../app/Decks/AIGeneratingScreen';
import AIDeckPreviewScreen from '../app/Decks/AIDeckPreviewScreen';
import AIHintsConfigScreen from '../app/Decks/AIHintsConfigScreen';
import AIHintsGeneratingScreen from '../app/Decks/AIHintsGeneratingScreen';

const Stack = createNativeStackNavigator();

export default function DecksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DecksList" component={DecksScreen} />
      <Stack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <Stack.Screen name="DeckBrowser" component={CardBrowserScreen} />
      <Stack.Screen name="NoteEditor" component={NoteEditorScreen} />
      <Stack.Screen name="AIDeckCreator" component={AIDeckCreatorScreen} />
      <Stack.Screen name="AIGenerating" component={AIGeneratingScreen} />
      <Stack.Screen name="AIDeckPreview" component={AIDeckPreviewScreen} />
      <Stack.Screen name="AIHintsConfig" component={AIHintsConfigScreen} />
      <Stack.Screen name="AIHintsGenerating" component={AIHintsGeneratingScreen} />
    </Stack.Navigator>
  );
}
