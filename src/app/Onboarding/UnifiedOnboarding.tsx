import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../design/theme';
import { useAuth } from '../../context/AuthContext';
import { UserPrefsService } from '../../services/onboarding/UserPrefsService';
import { FirstRunGuide } from '../../guided/FirstRunGuide';
import { s } from '../../design/spacing';

// Import setup step components
import ProfileStep from './components/ProfileStep';
import StudyGoalStep from './components/StudyGoalStep';
import ThemeStep from './components/ThemeStep';
import NotificationsStep from './components/NotificationsStep';
import { logger } from '../../utils/logger';

interface UnifiedOnboardingProps {
  onComplete: () => void;
}

type Step = 'profile' | 'goal' | 'theme' | 'notifications';

const TOTAL_STEPS = 4;

const STEP_ORDER: Step[] = [
  'profile',
  'goal',
  'theme',
  'notifications',
];

export default function UnifiedOnboarding({ onComplete }: UnifiedOnboardingProps) {
  const theme = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [onboardingData, setOnboardingData] = useState<any>({});

  const currentStep = STEP_ORDER[currentStepIndex];
  const progress = ((currentStepIndex + 1) / TOTAL_STEPS) * 100;

  const handleNext = (data?: any) => {
    if (data) {
      setOnboardingData((prev: any) => ({ ...prev, ...data }));
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (currentStepIndex < TOTAL_STEPS - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      Haptics.selectionAsync();
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    if (!user?.uid) return;

    try {
      // Save all data
      if (onboardingData.profile) {
        await UserPrefsService.setUserProfile(user.uid, onboardingData.profile);
      }
      
      if (onboardingData.goalMinutes || onboardingData.themeMode) {
        await UserPrefsService.setUserPreferences(user.uid, {
          goalMinutes: onboardingData.goalMinutes || 15,
          themePreference: onboardingData.themeMode || 'dark',
          dailyReminder: onboardingData.notificationsEnabled || false,
          schedule: 'anytime',
        });
      }

      await UserPrefsService.setOnboardingCompleted(user.uid);
      
      onComplete();
    } catch (error) {
      logger.error('[UnifiedOnboarding] Error saving:', error);
      onComplete(); // Complete anyway
    }
  };

  const renderStep = () => {
    const stepProps = {
      onNext: handleNext,
      onBack: currentStepIndex > 0 ? handleBack : undefined,
    };

    switch (currentStep) {
      case 'profile':
        return <ProfileStep {...stepProps} />;
      
      case 'goal':
        return <StudyGoalStep {...stepProps} />;
      
      case 'theme':
        return <ThemeStep {...stepProps} />;
      
      case 'notifications':
        return <NotificationsStep {...stepProps} isLast />;
      
      default:
        return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Progress Bar */}
      <View style={[styles.progressContainer, { paddingTop: insets.top + s.md }]}>
        <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.colors.accent,
                width: `${progress}%`,
              },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: theme.colors.textTertiary }]}>
          {currentStepIndex + 1} of {TOTAL_STEPS}
        </Text>
      </View>

      {/* Step Content */}
      <Animated.View 
        key={currentStep}
        entering={FadeInRight.duration(300)}
        exiting={FadeOutLeft.duration(300)}
        style={styles.stepContainer}
      >
        {renderStep()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: s.xl,
    paddingBottom: s.lg,
    gap: s.xs,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  stepContainer: {
    flex: 1,
  },
});
