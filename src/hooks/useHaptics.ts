import * as Haptics from 'expo-haptics';

export function useHaptics() {
  return {
    selection: () => Haptics.selectionAsync(),
    success:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    warning:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    error:     () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    
    // Success = rewarding, failure = unsatisfying
    // Good = solid reward, Easy = extra reward, Hard = disappointing, Again = bad
    
    ratingEasy: async () => {
      // Extra reward - double heavy punch
      // Pattern: "::" - Very satisfying, bonus feeling
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 70);
    },
    
    ratingGood: async () => {
      // Solid reward - single heavy punch
      // Pattern: "!" - Clean, satisfying, confident
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    },
    
    ratingHard: async () => {
      // Disappointing - weak double tap
      // Pattern: ".." - Feels hesitant, unsatisfying, like struggling
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 60);
    },
    
    ratingAgain: async () => {
      // Bad feeling - single weak tap
      // Pattern: "." - Minimal feedback, feels like failure
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
  };
}
