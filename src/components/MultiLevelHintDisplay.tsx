import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions, ScrollView } from 'react-native';
import Animated, { 
  FadeIn,
  FadeOut,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';
import RenderHtml from 'react-native-render-html';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../design';
import { s } from '../design/spacing';
import { r } from '../design/radii';
import { useHaptics } from '../hooks/useHaptics';

type HintLevel = 'L1' | 'L2' | 'L3';

interface MultiLevelHintDisplayProps {
  hintL1: string;
  hintL2: string;
  hintL3: string;
  onClose?: () => void;
  onHintRevealed?: (depth: 1 | 2 | 3) => void; // Callback when user reveals a hint level
}

const LEVEL_INFO = {
  L1: {
    title: 'Minimal',
    subtitle: 'Try this first',
    icon: 'bulb-outline' as const,
  },
  L2: {
    title: 'Guided',
    subtitle: 'More context',
    icon: 'bulb' as const,
  },
  L3: {
    title: 'Full',
    subtitle: 'Maximum help',
    icon: 'flash' as const,
  },
};

export function MultiLevelHintDisplay({ hintL1, hintL2, hintL3, onClose, onHintRevealed }: MultiLevelHintDisplayProps) {
  const theme = useTheme();
  const HINT_COLOR = theme.colors.primary; // Brand primary for hints
  const { selection } = useHaptics();
  const { width } = useWindowDimensions();
  
  const [currentLevel, setCurrentLevel] = useState<HintLevel>('L1');
  const [contentKey, setContentKey] = useState(0);
  const [revealedLevels, setRevealedLevels] = useState<Set<HintLevel>>(new Set(['L1'])); // Track which levels have been revealed
  
  // Track L1 reveal on mount
  React.useEffect(() => {
    if (onHintRevealed) {
      onHintRevealed(1);
    }
  }, []);
  
  const getCurrentHint = () => {
    switch (currentLevel) {
      case 'L1': return hintL1;
      case 'L2': return hintL2;
      case 'L3': return hintL3;
    }
  };
  
  const currentInfo = LEVEL_INFO[currentLevel];
  
  const changeLevel = (newLevel: HintLevel) => {
    if (newLevel === currentLevel) return;
    selection();
    setCurrentLevel(newLevel);
    setContentKey(prev => prev + 1);
    
    // Track hint reveal if this level hasn't been revealed yet
    if (!revealedLevels.has(newLevel)) {
      setRevealedLevels(prev => new Set(prev).add(newLevel));
      if (onHintRevealed) {
        const depth = newLevel === 'L1' ? 1 : newLevel === 'L2' ? 2 : 3;
        onHintRevealed(depth);
      }
    }
  };

  const htmlStyles = {
    body: {
      fontSize: 19,
      lineHeight: 30,
      color: theme.colors.textPrimary,
    },
    strong: {
      color: HINT_COLOR,
      fontWeight: '700' as const,
    },
    em: {
      fontStyle: 'italic' as const,
      color: theme.colors.textSecondary,
    },
    code: {
      backgroundColor: theme.colors.overlay.primary,
      color: HINT_COLOR,
      fontFamily: 'monospace' as const,
      padding: 4,
      borderRadius: 6,
    },
    sub: {
      fontSize: 12,
    },
    sup: {
      fontSize: 12,
    },
    u: {
      textDecorationLine: 'underline' as const,
    },
    mark: {
      backgroundColor: theme.colors.overlay.primary,
      color: HINT_COLOR,
    },
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface2 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: HINT_COLOR }]}>
            <Ionicons name="bulb" size={24} color={theme.colors.onPrimary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.colors.textHigh }]}>
              Hint
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMed }]}>
              {currentInfo.subtitle}
            </Text>
          </View>
        </View>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close-circle" size={28} color={theme.colors.textMed} />
          </Pressable>
        )}
      </View>

      {/* Compact Level Pills */}
      <View style={styles.pillsRow}>
        {(['L1', 'L2', 'L3'] as HintLevel[]).map((level) => {
          const levelInfo = LEVEL_INFO[level];
          const isActive = currentLevel === level;
          return (
            <Pressable
              key={level}
              onPress={() => changeLevel(level)}
              style={({ pressed }) => [
                styles.pill,
                {
                  backgroundColor: isActive ? HINT_COLOR : 'transparent',
                  borderColor: isActive ? HINT_COLOR : theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons 
                name={levelInfo.icon} 
                size={16} 
                color={isActive ? theme.colors.onPrimary : theme.colors.textMed} 
              />
              <Text style={[
                styles.pillText,
                { color: isActive ? theme.colors.onPrimary : theme.colors.textMed }
              ]}>
                {levelInfo.title}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Hint Content */}
      <ScrollView 
        style={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View
          key={contentKey}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={styles.contentCard}
        >
          <RenderHtml
            contentWidth={width - 48}
            source={{ html: getCurrentHint() }}
            tagsStyles={htmlStyles}
          />
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: s.xl,
    paddingBottom: s.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    flex: 1,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  scrollContainer: {
    maxHeight: 450,
  },
  contentCard: {
    padding: s.xl * 1.5,
    paddingTop: s.xl,
    paddingBottom: s.xl * 2,
    minHeight: 150,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: s.sm,
    paddingHorizontal: s.xl,
    paddingVertical: s.lg,
    backgroundColor: 'transparent',
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.xs,
    paddingVertical: s.md,
    paddingHorizontal: s.sm,
    borderRadius: r.full,
    borderWidth: 1.5,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
