import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { UserPrefsService } from '../services/onboarding/UserPrefsService';
import WelcomeScreen from '../app/Auth/WelcomeScreen';
import SignUpScreen from '../app/Auth/SignUpScreen';
import SignInScreen from '../app/Auth/SignInScreen';
import UnifiedOnboarding from '../app/Onboarding/UnifiedOnboarding';
import Tabs from './Tabs';
import { FirstRunGuide } from '../guided/FirstRunGuide';
import { logger } from '../utils/logger';

type AuthScreen = 'welcome' | 'signup' | 'signin';

/**
 * AuthNavigator - Duolingo-style flow: Welcome -> SignUp/SignIn -> Tutorial (new users) -> Main App
 */
export default function AuthNavigator() {
  const { user, loading: authLoading } = useAuth();
  const [tutorialCompleted, setTutorialCompleted] = useState<boolean | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);
  const [authScreen, setAuthScreen] = useState<AuthScreen>('welcome');

  // Feature flag: Always show tutorial + onboarding on app launch (for development/testing)
  // Set to false to use normal "only new users" behavior
  const SHOW_TUTORIAL_ON_LAUNCH = false;

  // Check tutorial status when user changes (only runs once per user change)
  useEffect(() => {
    const checkStatus = async () => {
      if (!user) {
        setTutorialCompleted(null);
        setChecking(false);
        return;
      }

      setChecking(true);
      
      // If flag is enabled, force tutorial + onboarding by setting both to false
      if (SHOW_TUTORIAL_ON_LAUNCH) {
        logger.info('[AuthNavigator] SHOW_TUTORIAL_ON_LAUNCH enabled - forcing tutorial + onboarding');
        setTutorialCompleted(false);
        setOnboardingCompleted(false);
        setChecking(false);
        return;
      }
      
      try {
        let tutorial = await UserPrefsService.getTutorialCompleted(user.uid);
        let onboarding = await UserPrefsService.getOnboardingCompleted(user.uid);

        // If no flags exist, check if this is a new user
        if (!tutorial) {
          const isNewUser = await UserPrefsService.isNewUser(user.uid);
          if (!isNewUser) {
            // Returning user with no flags - mark complete and skip everything
            await UserPrefsService.setTutorialCompleted(user.uid, true);
            await UserPrefsService.setOnboardingCompleted(user.uid, true);
            tutorial = true;
            onboarding = true;
          }
          // else: New user (tutorial = false, onboarding = false), show both
        }

        setTutorialCompleted(tutorial);
        setOnboardingCompleted(onboarding);

        // For existing users (already completed onboarding), mark quickstart guides as done
        if (tutorial && onboarding && user.uid) {
          try {
            await FirstRunGuide.markWelcomeShown(user.uid);
            await FirstRunGuide.markDiscoverShown(user.uid);
            await FirstRunGuide.completeDiscover(user.uid);
            await FirstRunGuide.markStudyShown(user.uid);
            await FirstRunGuide.completeStudy(user.uid);
          } catch (err) {
            logger.warn('[AuthNavigator] Failed to pre-complete quickstart guides:', err);
          }
        }
      } catch (error) {
        logger.error('[AuthNavigator] Error checking status:', error);
        // Default to skipping everything on error (safer for returning users)
        setTutorialCompleted(true);
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

  // 1. No user -> Show auth flow (MUST come first)
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

  // 2. User IS authenticated - check onboarding completion
  
  // Show unified onboarding (tutorial + setup) if not completed
  if (tutorialCompleted !== true || onboardingCompleted !== true) {
    logger.info('[AuthNavigator] Showing unified onboarding for user:', user.uid);
    return (
      <UnifiedOnboarding 
        onComplete={() => {
          setTutorialCompleted(true);
          setOnboardingCompleted(true);
        }} 
      />
    );
  }

  // Everything completed -> Main App
  logger.info('[AuthNavigator] All onboarding completed, showing main app');
  return <Tabs />;
}
