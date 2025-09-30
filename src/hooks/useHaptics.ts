import * as Haptics from 'expo-haptics';

export function useHaptics() {
  return {
    selection: () => Haptics.selectionAsync(),
    success:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    warning:   () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
    error:     () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  };
}
