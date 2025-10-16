import React, { useState } from 'react';
import ProfileScreen from './ProfileScreen';
import StudyGoalScreen from './StudyGoalScreen';
import ThemeSelectionScreen from './ThemeSelectionScreen';
import NotificationsScreen from './NotificationsScreen';
import { UserPrefsService } from '../../services/onboarding/UserPrefsService';
import { useAuth } from '../../context/AuthContext';

interface OnboardingFlowProps {
  onComplete: () => void;
}

type OnboardingStep = 'profile' | 'goal' | 'theme' | 'notifications';

interface ProfileData {
  displayName: string;
  firstName: string;
  lastName?: string;
}

interface OnboardingData {
  profile: ProfileData;
  goalMinutes: number;
  themeMode: 'system' | 'light' | 'dark';
  colorScheme: string;
  notificationsEnabled: boolean;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('profile');
  const [data, setData] = useState<Partial<OnboardingData>>({});

  const handleProfileComplete = (profileData: ProfileData) => {
    setData(prev => ({ ...prev, profile: profileData }));
    setCurrentStep('goal');
  };

  const handleGoalComplete = (goalMinutes: number) => {
    setData(prev => ({ ...prev, goalMinutes }));
    setCurrentStep('theme');
  };

  const handleThemeComplete = (themeMode: 'system' | 'light' | 'dark', colorScheme: string) => {
    setData(prev => ({ ...prev, themeMode, colorScheme }));
    setCurrentStep('notifications');
  };

  const handleNotificationsComplete = async (notificationsEnabled: boolean) => {
    if (!user?.uid) return;

    const finalData = { ...data, notificationsEnabled } as OnboardingData;

    try {
      // Save all onboarding data
      await UserPrefsService.setUserProfile(user.uid, finalData.profile);
      await UserPrefsService.setUserPreferences(user.uid, {
        goalMinutes: finalData.goalMinutes,
        themePreference: finalData.themeMode,
        dailyReminder: notificationsEnabled,
        schedule: 'anytime',
      });
      await UserPrefsService.setOnboardingCompleted(user.uid);

      // Mark complete
      onComplete();
    } catch (error) {
      console.error('[OnboardingFlow] Error saving data:', error);
      // Still complete even if save fails
      onComplete();
    }
  };

  // Navigation
  if (currentStep === 'profile') {
    return (
      <ProfileScreen
        onContinue={handleProfileComplete}
        onSkip={() => handleProfileComplete({ displayName: 'User', firstName: 'User' })}
      />
    );
  }

  if (currentStep === 'goal') {
    return (
      <StudyGoalScreen
        onContinue={handleGoalComplete}
        onBack={() => setCurrentStep('profile')}
      />
    );
  }

  if (currentStep === 'theme') {
    return (
      <ThemeSelectionScreen
        onContinue={handleThemeComplete}
        onBack={() => setCurrentStep('goal')}
      />
    );
  }

  return (
    <NotificationsScreen
      onContinue={handleNotificationsComplete}
      onBack={() => setCurrentStep('theme')}
    />
  );
}
