import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import PrimaryButton from '../../components/PrimaryButton';

interface ProfileData {
  displayName: string;
  firstName: string;
  lastName?: string;
}

interface PreferencesData {
  dailyReminder: boolean;
  schedule: 'morning' | 'evening' | 'anytime';
  goalMinutes: number;
}

interface PreferencesScreenProps {
  profileData: ProfileData;
  onContinue: (data: PreferencesData) => void;
  onBack: () => void;
}

export default function PreferencesScreen({ profileData, onContinue, onBack }: PreferencesScreenProps) {
  const theme = useTheme();

  const [dailyReminder, setDailyReminder] = useState(false);
  const [schedule, setSchedule] = useState<'morning' | 'evening' | 'anytime'>('anytime');
  const [goalMinutes, setGoalMinutes] = useState(15);

  const scheduleOptions = [
    { value: 'morning', label: 'Morning', icon: 'sunny', description: '8 AM - 12 PM' },
    { value: 'evening', label: 'Evening', icon: 'moon', description: '6 PM - 10 PM' },
    { value: 'anytime', label: 'Anytime', icon: 'time', description: 'Flexible schedule' },
  ] as const;

  const goalOptions = [5, 10, 15, 20, 30, 45, 60];

  const handleContinue = () => {
    onContinue({
      dailyReminder,
      schedule,
      goalMinutes,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={{ padding: s.sm }}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.stepText, { color: theme.colors.textTertiary }]}>
          Step 2 of 2
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Title Section */}
          <View style={styles.titleSection}>
            <View style={[styles.iconContainer, { backgroundColor: theme.colors.accent + '20' }]}>
              <Ionicons name="settings" size={32} color={theme.colors.accent} />
            </View>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Study Preferences
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
              Customize your learning routine
            </Text>
          </View>

          {/* Daily Reminder Toggle */}
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="notifications" size={24} color={theme.colors.accent} />
                <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                  Daily Reminder
                </Text>
              </View>
              <Switch
                value={dailyReminder}
                onValueChange={setDailyReminder}
                trackColor={{ false: theme.colors.border, true: theme.colors.accent + '60' }}
                thumbColor={dailyReminder ? theme.colors.accent : theme.colors.textTertiary}
              />
            </View>
            <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
              Get a notification to review your cards
            </Text>
          </View>

          {/* Study Schedule */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="calendar" size={24} color={theme.colors.accent} />
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                Preferred Study Time
              </Text>
            </View>
            <View style={styles.optionGrid}>
              {scheduleOptions.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.optionCard,
                    { 
                      backgroundColor: theme.colors.surface,
                      borderColor: schedule === option.value ? theme.colors.accent : theme.colors.border,
                      borderWidth: schedule === option.value ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSchedule(option.value)}
                >
                  <Ionicons 
                    name={option.icon} 
                    size={28} 
                    color={schedule === option.value ? theme.colors.accent : theme.colors.textSecondary} 
                  />
                  <Text style={[
                    styles.optionLabel, 
                    { color: schedule === option.value ? theme.colors.accent : theme.colors.textPrimary }
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.optionDescription, { color: theme.colors.textTertiary }]}>
                    {option.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Daily Goal */}
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="flag" size={24} color={theme.colors.accent} />
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                Daily Goal
              </Text>
            </View>
            <View style={styles.goalGrid}>
              {goalOptions.map((minutes) => (
                <Pressable
                  key={minutes}
                  style={[
                    styles.goalChip,
                    { 
                      backgroundColor: goalMinutes === minutes ? theme.colors.accent : theme.colors.surface,
                      borderColor: goalMinutes === minutes ? theme.colors.accent : theme.colors.border,
                    },
                  ]}
                  onPress={() => setGoalMinutes(minutes)}
                >
                  <Text style={[
                    styles.goalText,
                    { color: goalMinutes === minutes ? '#000' : theme.colors.textPrimary }
                  ]}>
                    {minutes} min
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={[styles.actions, { backgroundColor: theme.colors.bg }]}>
        <PrimaryButton
          title="Continue →"
          onPress={handleContinue}
        />
      </View>
    </SafeAreaView>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.xl,
    gap: s.xl,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: s.lg,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: r.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: s.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    gap: s.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: s.lg,
    borderRadius: r.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    marginBottom: s.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
    paddingLeft: s.lg,
    lineHeight: 20,
  },
  optionGrid: {
    flexDirection: 'row',
    gap: s.md,
  },
  optionCard: {
    flex: 1,
    padding: s.lg,
    borderRadius: r.md,
    alignItems: 'center',
    gap: s.sm,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.sm,
  },
  goalChip: {
    paddingHorizontal: s.lg,
    paddingVertical: s.md,
    borderRadius: r.md,
    borderWidth: 1,
  },
  goalText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    padding: s.xl,
    paddingTop: s.md,
  },
});
