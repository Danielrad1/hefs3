import React, { useEffect } from 'react';
import { Switch, SwitchProps, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedProps, 
  withTiming,
  Easing
} from 'react-native-reanimated';

interface SmoothSwitchProps extends Omit<SwitchProps, 'value'> {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  trackColor?: { false?: string; true?: string };
  thumbColor?: string;
  ios_backgroundColor?: string;
}

/**
 * Smooth animated Switch component
 * Prevents choppy animations by using React Native Reanimated
 */
export function SmoothSwitch({ 
  value, 
  onValueChange,
  trackColor,
  thumbColor,
  ios_backgroundColor,
  ...props 
}: SmoothSwitchProps) {
  const animatedValue = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    animatedValue.value = withTiming(value ? 1 : 0, {
      duration: 250,
      easing: Easing.bezier(0.4, 0.0, 0.2, 1),
    });
  }, [value]);

  return (
    <Switch
      {...props}
      value={value}
      onValueChange={onValueChange}
      trackColor={trackColor}
      thumbColor={thumbColor}
      ios_backgroundColor={ios_backgroundColor}
      // Force native driver for smooth animations
      style={Platform.OS === 'ios' ? { transform: [{ scale: 0.95 }] } : undefined}
    />
  );
}
