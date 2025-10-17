import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SettingsScreen from '../app/Settings/SettingsScreen';
import ThemeSelectionScreen from '../app/Settings/ThemeSelectionScreen';

const Stack = createNativeStackNavigator();

export default function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SettingsMain" component={SettingsScreen} />
      <Stack.Screen name="ThemeSelection" component={ThemeSelectionScreen} />
    </Stack.Navigator>
  );
}
