import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import PrimaryButton from '../../components/PrimaryButton';

interface NotificationsScreenProps {
  onContinue: (enabled: boolean) => void;
  onBack: () => void;
}

export default function NotificationsScreen({ onContinue, onBack }: NotificationsScreenProps) {
  const theme = useTheme();

  const handleEnable = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // For now, just save the preference
    // Actual notification permission will be requested when user enables reminders in Settings
    onContinue(true);
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    onContinue(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={{ padding: s.sm }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.stepText, { color: theme.colors.textTertiary }]}>
          Step 4 of 4
        </Text>
      </View>

      <View style={styles.content}>
        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent + '20' }]}>
            <Ionicons name="notifications" size={40} color={theme.colors.accent} />
          </View>
          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Stay on Track
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Get gentle reminders to review your cards and maintain your streak
          </Text>
        </View>

        {/* Benefits */}
        <View style={styles.benefits}>
          <BenefitItem
            icon="calendar"
            title="Daily Reminders"
            description="Never miss your study session"
            theme={theme}
          />
          <BenefitItem
            icon="flame"
            title="Maintain Streaks"
            description="Build consistent learning habits"
            theme={theme}
          />
          <BenefitItem
            icon="time"
            title="Perfect Timing"
            description="Review cards when they're due"
            theme={theme}
          />
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <PrimaryButton
            title="Enable Notifications"
            onPress={handleEnable}
          />
          <Pressable 
            onPress={handleSkip} 
            style={{ paddingVertical: s.md, alignItems: 'center' }}
          >
            <Text style={[{ color: theme.colors.textSecondary, fontSize: 15, fontWeight: '500' }]}>
              Maybe Later
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

interface BenefitItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  theme: any;
}

function BenefitItem({ icon, title, description, theme }: BenefitItemProps) {
  return (
    <View style={styles.benefitItem}>
      <View style={[styles.benefitIcon, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name={icon} size={24} color={theme.colors.accent} />
      </View>
      <View style={styles.benefitText}>
        <Text style={[styles.benefitTitle, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.benefitDescription, { color: theme.colors.textSecondary }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    paddingHorizontal: s.xl,
    paddingBottom: s.xl,
    justifyContent: 'space-between',
  },
  titleSection: {
    alignItems: 'center',
    paddingTop: s.xl * 2,
    gap: s.md,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: r.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: s.md,
  },
  benefits: {
    gap: s.lg,
    paddingVertical: s.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.lg,
  },
  benefitIcon: {
    width: 56,
    height: 56,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: s.xs,
  },
  benefitDescription: {
    fontSize: 15,
    lineHeight: 20,
  },
  actions: {
    gap: s.sm,
  },
});
