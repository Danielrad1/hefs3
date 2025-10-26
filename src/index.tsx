// Load Firebase app module early to ensure proper initialization order
import '@react-native-firebase/app';

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNav from './navigation';
import { SchedulerProvider } from './context/SchedulerProvider';
import { AuthProvider } from './context/AuthContext';
import { PremiumProvider } from './context/PremiumContext';
import { ThemeProvider } from './design/theme';
import { PersistenceService } from './services/anki/PersistenceService';
import { db } from './services/anki/InMemoryDb';
import { deckMetadataService } from './services/anki/DeckMetadataService';
import { logger } from './utils/logger';
import { OfflineBanner } from './components/OfflineBanner';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initializeApp() {
      try {
        logger.info('[App] Loading database...');
        const loaded = await PersistenceService.load(db);
        if (loaded) {
          logger.info('[App] Database loaded from disk');
        } else {
          logger.info('[App] No saved database found, starting fresh');
        }
        
        // Preload metadata in parallel to avoid delays later
        await Promise.all([
          deckMetadataService.load(),
          deckMetadataService.loadFolders()
        ]);
      } catch (error) {
        logger.error('[App] Error loading database:', error);
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
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <PremiumProvider>
              <SchedulerProvider>
                <RootNav />
                <OfflineBanner />
                <StatusBar style="auto" />
              </SchedulerProvider>
            </PremiumProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
