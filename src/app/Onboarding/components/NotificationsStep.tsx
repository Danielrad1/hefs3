import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';
import PrimaryButton from '../../../components/PrimaryButton';

interface NotificationsStepProps {
  onNext: (data: { notificationsEnabled: boolean }) => void;
  onBack?: () => void;
  isLast?: boolean;
}

export default function NotificationsStep({ onNext, onBack, isLast }: NotificationsStepProps) {
  const theme = useTheme();

  const handleEnable = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus === 'granted') {
        console.log('[Notifications] Permission granted');
        onNext({ notificationsEnabled: true });
      } else {
        console.log('[Notifications] Permission denied');
        Alert.alert(
          'Notifications Disabled',
          'You can enable notifications later in Settings.',
          [{ text: 'OK', onPress: () => onNext({ notificationsEnabled: false }) }]
        );
      }
    } catch (error) {
      console.error('[Notifications] Error requesting permission:', error);
      onNext({ notificationsEnabled: false });
    }
  };

  const handleSkip = () => {
    Haptics.selectionAsync();
    onNext({ notificationsEnabled: false });
  };

  return (
    <View style={styles.container}>
      {onBack && (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
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

        <View style={styles.benefits}>
          <BenefitItem icon="calendar" title="Daily Reminders" description="Never miss your study session" theme={theme} />
          <BenefitItem icon="flame" title="Maintain Streaks" description="Build consistent learning habits" theme={theme} />
          <BenefitItem icon="time" title="Perfect Timing" description="Review cards when they're due" theme={theme} />
        </View>
      </View>

      <View style={[styles.footer, { backgroundColor: theme.colors.bg, borderTopColor: theme.colors.border }]}>
        <PrimaryButton
          title={isLast ? "Let's Go!" : "Enable Notifications"}
          onPress={handleEnable}
        />
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text style={[styles.skipText, { color: theme.colors.textSecondary }]}>
            Maybe Later
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function BenefitItem({ icon, title, description, theme }: any) {
  return (
    <View style={styles.benefitItem}>
      <View style={[styles.benefitIcon, { backgroundColor: theme.colors.surface }]}>
        <Ionicons name={icon} size={24} color={theme.colors.accent} />
      </View>
      <View style={styles.benefitText}>
        <Text style={[styles.benefitTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.benefitDescription, { color: theme.colors.textSecondary }]}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backButton: { padding: s.md, paddingLeft: s.lg },
  content: { flex: 1, paddingHorizontal: s.xl, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: s.xl * 2, gap: s.md },
  iconContainer: { width: 96, height: 96, borderRadius: r.xl, justifyContent: 'center', alignItems: 'center', marginBottom: s.md },
  title: { fontSize: 32, fontWeight: '800', textAlign: 'center' },
  subtitle: { fontSize: 17, textAlign: 'center', lineHeight: 24, paddingHorizontal: s.md },
  benefits: { gap: s.lg },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: s.lg },
  benefitIcon: { width: 56, height: 56, borderRadius: r.lg, justifyContent: 'center', alignItems: 'center' },
  benefitText: { flex: 1 },
  benefitTitle: { fontSize: 17, fontWeight: '700', marginBottom: s.xs },
  benefitDescription: { fontSize: 15, lineHeight: 20 },
  footer: { paddingHorizontal: s.xl, paddingVertical: s.lg, paddingBottom: s.xl, borderTopWidth: 1, gap: s.sm },
  skipButton: { paddingVertical: s.md, alignItems: 'center' },
  skipText: { fontSize: 15, fontWeight: '500' },
});
