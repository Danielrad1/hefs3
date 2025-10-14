import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions, Pressable } from 'react-native';
import Animated, { 
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import RenderHtml from 'react-native-render-html';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../design';
import { s } from '../design/spacing';
import { r } from '../design/radii';

interface TipDisplayProps {
  tip: string;
  confusableContrast?: string;
  onClose?: () => void;
}

const TIP_COLOR = '#EC4899'; // Pink

export function TipDisplay({ tip, confusableContrast, onClose }: TipDisplayProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  // HTML renderer styles
  const htmlStyles = {
    body: {
      fontSize: 19,
      lineHeight: 30,
      color: theme.colors.textPrimary,
    },
    strong: {
      color: '#EC4899',
      fontWeight: '700' as const,
    },
    em: {
      fontStyle: 'italic' as const,
      color: theme.colors.textSecondary,
    },
    code: {
      backgroundColor: 'rgba(236, 72, 153, 0.15)',
      color: '#EC4899',
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
      backgroundColor: 'rgba(236, 72, 153, 0.25)',
      color: '#EC4899',
    },
  };
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: TIP_COLOR }]}>
            <Ionicons name="sparkles" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Memory Tip
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Post-reveal elaboration
            </Text>
          </View>
        </View>
        {onClose && (
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close-circle" size={28} color={theme.colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Tip content - focused and prominent */}
      <View style={styles.contentCard}>
        <RenderHtml
          contentWidth={width - 48}
          source={{ html: tip }}
          tagsStyles={htmlStyles}
        />
        
        {/* Optional confusable contrast */}
        {confusableContrast && (
          <View style={[styles.contrastBadge, { backgroundColor: TIP_COLOR }]}>
            <Ionicons name="swap-horizontal" size={16} color="#FFFFFF" />
            <Text style={styles.contrastText}>
              {confusableContrast}
            </Text>
          </View>
        )}
      </View>
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
  contentCard: {
    padding: s.xl * 1.5,
    paddingTop: s.xl,
    paddingBottom: s.xl * 2,
    minHeight: 150,
  },
  contrastBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    paddingHorizontal: s.md,
    paddingVertical: s.sm,
    borderRadius: r.sm,
    alignSelf: 'flex-start',
    marginTop: s.md,
  },
  contrastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
