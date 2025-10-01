import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../app/Home/HomeScreen';
import StudyScreen from '../app/Study/StudyScreen';
import SettingsScreen from '../app/Settings/SettingsScreen';
import DecksStack from './DecksStack';

const Tab = createBottomTabNavigator();

export default function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Decks" component={DecksStack} />
      <Tab.Screen name="Study" component={StudyScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
