import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { Animated } from 'react-native';
import { useTheme } from '../../design';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type RevealButtonProps = {
  onPress: () => void;
  visible: boolean;
};

export default function RevealButton({ onPress, visible }: RevealButtonProps) {
  const theme = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(visible ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  const animatedStyle = {
    opacity,
    transform: [{ scale }],
  };

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  if (!visible) return null;

  return (
    <AnimatedPressable
      style={[
        styles.button,
        { backgroundColor: theme.colors.accent },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Text style={[styles.text, { color: '#FFFFFF' }]}>
        Reveal Answer
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderRadius: r.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
  },
});
