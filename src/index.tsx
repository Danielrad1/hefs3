import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNav from './navigation';
import { SchedulerProvider } from './context/SchedulerProvider';
import { ThemeProvider } from './design/theme';
import { PersistenceService } from './services/anki/PersistenceService';
import { db } from './services/anki/InMemoryDb';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initializeApp() {
      try {
        console.log('[App] Loading database...');
        const loaded = await PersistenceService.load(db);
        if (loaded) {
          console.log('[App] Database loaded from disk');
        } else {
          console.log('[App] No saved database found, starting fresh');
        }
      } catch (error) {
        console.error('[App] Error loading database:', error);
      } finally {
        setIsLoading(false);
      }
    }

    initializeApp();
  }, []);

  if (isLoading) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0B' }}>
          <ActivityIndicator size="large" color="#6EE7F2" />
          <Text style={{ color: '#EDEDED', marginTop: 16 }}>Loading...</Text>
        </View>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SchedulerProvider>
          <RootNav />
          <StatusBar style="auto" />
        </SchedulerProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
