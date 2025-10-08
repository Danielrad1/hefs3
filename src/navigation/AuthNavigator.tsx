import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import SignInScreen from '../app/Auth/SignInScreen';
import Tabs from './Tabs';

/**
 * AuthNavigator - Conditionally renders SignIn or main app based on auth state
 */
export default function AuthNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0B' }}>
        <ActivityIndicator size="large" color="#6EE7F2" />
      </View>
    );
  }

  // Require authentication to access the app
  return user ? <Tabs /> : <SignInScreen />;
}
