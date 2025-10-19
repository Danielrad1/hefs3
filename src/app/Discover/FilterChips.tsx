import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../design/theme';

interface FilterChipsProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

export function FilterChips({ categories, selectedCategory, onSelectCategory }: FilterChipsProps) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      bounces={false}
    >
      <Chip
        label="All"
        selected={selectedCategory === 'All'}
        onPress={() => onSelectCategory('All')}
        theme={theme}
      />
      {categories.map(category => (
        <Chip
          key={category}
          label={category}
          selected={selectedCategory === category}
          onPress={() => onSelectCategory(category)}
          theme={theme}
        />
      ))}
    </ScrollView>
  );
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: any;
}

function Chip({ label, selected, onPress, theme }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent }
          : { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected
            ? { color: '#FFFFFF', fontWeight: '700' }
            : { color: theme.colors.textSecondary, fontWeight: '600' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
  },
});
