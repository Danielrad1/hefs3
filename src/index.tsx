import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import RootNav from './navigation';
import { SchedulerProvider } from './context/SchedulerProvider';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SchedulerProvider>
        <RootNav />
        <StatusBar style="auto" />
      </SchedulerProvider>
    </GestureHandlerRootView>
  );
}
