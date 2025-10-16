import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WelcomeScreen from '../app/Onboarding/WelcomeScreen';
import ProfileScreen from '../app/Onboarding/ProfileScreen';
import PreferencesScreen from '../app/Onboarding/PreferencesScreen';
import ThemeScreen from '../app/Onboarding/ThemeScreen';

const Stack = createNativeStackNavigator();

export default function OnboardingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: false, // Prevent back swipe during onboarding
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} />
      <Stack.Screen name="Theme" component={ThemeScreen} />
    </Stack.Navigator>
  );
}
