import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Animated } from 'react-native';
import { Pressable } from 'react-native';
import { useTheme } from '../../design';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { Difficulty } from '../../domain/srsTypes';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type RightRailProps = {
  onAnswer: (difficulty: Difficulty) => void;
  visible: boolean;
};

type DifficultyButton = {
  difficulty: Difficulty;
  label: string;
  color: string;
};

const difficultyButtons: DifficultyButton[] = [
  { difficulty: 'again', label: 'Again', color: '#EF4444' },
  { difficulty: 'hard', label: 'Hard', color: '#F97316' },
  { difficulty: 'good', label: 'Good', color: '#10B981' },
  { difficulty: 'easy', label: 'Easy', color: '#3B82F6' },
];

export default function RightRail({ onAnswer, visible }: RightRailProps) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {difficultyButtons.map((button, index) => (
        <DifficultyButton
          key={button.difficulty}
          button={button}
          onPress={() => onAnswer(button.difficulty)}
          visible={visible}
          delay={index * 50} // Staggered animation
        />
      ))}
    </View>
  );
}

type DifficultyButtonProps = {
  button: DifficultyButton;
  onPress: () => void;
  visible: boolean;
  delay: number;
};

function DifficultyButton({ button, onPress, visible, delay }: DifficultyButtonProps) {
  const theme = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateX = React.useRef(new Animated.Value(50)).current;

  React.useEffect(() => {
    if (visible) {
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(opacity, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
      }, delay);
    } else {
      Animated.parallel([
        Animated.spring(opacity, {
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.spring(translateX, {
          toValue: 50,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, delay, opacity, translateX]);

  const animatedStyle = {
    opacity,
    transform: [
      { scale },
      { translateX },
    ],
  };

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      style={[
        styles.button,
        {
          backgroundColor: theme.isDark ? theme.colors.surface : button.color,
          borderColor: button.color,
          borderWidth: theme.isDark ? 2 : 0,
        },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!visible}
    >
      <Text
        style={[
          styles.buttonText,
          {
            color: theme.isDark ? button.color : '#FFFFFF',
            fontWeight: '700',
          },
        ]}
      >
        {button.label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: s.lg,
    top: '50%',
    transform: [{ translateY: -80 }], // Center vertically (4 buttons × 40px / 2)
    gap: s.sm,
  },
  button: {
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.md,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 14,
  },
});
