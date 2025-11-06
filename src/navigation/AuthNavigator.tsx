import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { UserPrefsService } from '../services/onboarding/UserPrefsService';
import PreAuthTutorial from '../app/Onboarding/PreAuthTutorial';
import WelcomeScreen from '../app/Auth/WelcomeScreen';
import SignUpScreen from '../app/Auth/SignUpScreen';
import SignInScreen from '../app/Auth/SignInScreen';
import UnifiedOnboarding from '../app/Onboarding/UnifiedOnboarding';
import Tabs from './Tabs';
import { FirstRunGuide } from '../guided/FirstRunGuide';
import { logger } from '../utils/logger';

type AuthScreen = 'tutorial' | 'welcome' | 'signup' | 'signin';

/**
 * AuthNavigator - Flow: Tutorial Slides -> SignUp/SignIn -> Welcome Screen -> Main App
 */
export default function AuthNavigator() {
  const { user, loading: authLoading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('tutorial');

  // Feature flag: Always show tutorial + onboarding on app launch (for development/testing)
  // Set to false to use normal "only new users" behavior
  const SHOW_TUTORIAL_ON_LAUNCH = false;

  // Check onboarding status when user changes
  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        setOnboardingCompleted(null);
        setChecking(false);
        return;
      }

      setChecking(true);
      
      // If flag is enabled, force onboarding to show
      if (SHOW_TUTORIAL_ON_LAUNCH) {
        logger.info('[AuthNavigator] SHOW_TUTORIAL_ON_LAUNCH enabled - forcing onboarding');
        setOnboardingCompleted(false);
        setChecking(false);
        return;
      }
      
      try {
        let onboarding = await UserPrefsService.getOnboardingCompleted(user.uid);

        // If no flag exists, check if this is a new user
        if (!onboarding) {
          const isNewUser = await UserPrefsService.isNewUser(user.uid);
          if (!isNewUser) {
            // Returning user with no flag - mark complete and skip onboarding
            await UserPrefsService.setOnboardingCompleted(user.uid, true);
            onboarding = true;
          }
        }

        setOnboardingCompleted(onboarding);
      } catch (error) {
        logger.error('[AuthNavigator] Error checking status:', error);
        // Default to skipping onboarding on error (safer for returning users)
        setOnboardingCompleted(true);
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
  }, [user]);

  // Show loading spinner while checking auth or tutorial status
  if (authLoading || checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0B' }}>
        <ActivityIndicator size="large" color="#6EE7F2" />
      </View>
    );
  }

  // 1. Show pre-auth tutorial first (before any auth)
  if (!user && authScreen === 'tutorial') {
    return (
      <PreAuthTutorial
        onComplete={() => setAuthScreen('welcome')}
      />
    );
  }

  // 2. No user -> Show auth flow
  if (!user) {
    if (authScreen === 'welcome') {
      return (
        <WelcomeScreen
          onGetStarted={() => setAuthScreen('signup')}
          onSignIn={() => setAuthScreen('signin')}
        />
      );
    }
    
    if (authScreen === 'signup') {
      return (
        <SignUpScreen
          onBack={() => setAuthScreen('welcome')}
          onSignIn={() => setAuthScreen('signin')}
        />
      );
    }
    
    return (
      <SignInScreen
        onBack={() => setAuthScreen('welcome')}
        onSignUp={() => setAuthScreen('signup')}
      />
    );
  }

  // 3. User IS authenticated - show welcome onboarding if not completed
  if (onboardingCompleted !== true) {
    logger.info('[AuthNavigator] Showing welcome onboarding for user:', user.uid);
    return (
      <UnifiedOnboarding 
        onComplete={() => {
          setOnboardingCompleted(true);
        }} 
      />
    );
  }

  // Everything completed -> Main App
  logger.info('[AuthNavigator] All onboarding completed, showing main app');
  return <Tabs />;
}
