import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DecksScreen from '../app/Decks/DecksScreen';
import DeckDetailScreen from '../app/Decks/DeckDetailScreen';
import DeckStatsScreen from '../app/Decks/DeckStatsScreen';
import CardBrowserScreen from '../app/Browser/CardBrowserScreen';
import NoteEditorScreen from '../app/Editor/NoteEditorScreen';
import ImageOcclusionEditorScreen from '../app/Editor/ImageOcclusionEditorScreen';
import AIDeckCreatorScreen from '../app/Decks/AIDeckCreatorScreen';
import AIGeneratingScreen from '../app/Decks/AIGeneratingScreen';
import AIDeckPreviewScreen from '../app/Decks/AIDeckPreviewScreen';
import AIHintsConfigScreen from '../app/Decks/AIHintsConfigScreen';
import AIHintsModelSelectionScreen from '../app/Decks/AIHintsModelSelectionScreen';
import AIHintsGeneratingScreen from '../app/Decks/AIHintsGeneratingScreen';
import ManageHintsScreen from '../app/Decks/ManageHintsScreen';

const Stack = createNativeStackNavigator();

export default function DecksStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DecksList" component={DecksScreen} />
      <Stack.Screen name="DeckDetail" component={DeckDetailScreen} />
      <Stack.Screen name="DeckStats" component={DeckStatsScreen} />
      <Stack.Screen name="DeckBrowser" component={CardBrowserScreen} />
      <Stack.Screen name="NoteEditor" component={NoteEditorScreen} />
      <Stack.Screen name="ImageOcclusionEditor" component={ImageOcclusionEditorScreen} />
      <Stack.Screen name="AIDeckCreator" component={AIDeckCreatorScreen} />
      <Stack.Screen name="AIGenerating" component={AIGeneratingScreen} />
      <Stack.Screen name="AIDeckPreview" component={AIDeckPreviewScreen} />
      <Stack.Screen name="AIHintsConfig" component={AIHintsConfigScreen} />
      <Stack.Screen name="AIHintsModelSelection" component={AIHintsModelSelectionScreen} />
      <Stack.Screen name="AIHintsGenerating" component={AIHintsGeneratingScreen} />
      <Stack.Screen name="ManageHints" component={ManageHintsScreen} />
    </Stack.Navigator>
  );
}
