/**
 * DeckSettingsScreen - Configure deck options (daily limits, learning steps, etc.)
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { PersistenceService } from '../../services/anki/PersistenceService';
import { logger } from '../../utils/logger';

interface DeckSettingsScreenProps {
  route: {
    params: {
      deckId: string;
    };
  };
  navigation: any;
}

export default function DeckSettingsScreen({ route, navigation }: DeckSettingsScreenProps) {
  const { deckId } = route.params;
  const theme = useTheme();
  
  const deck = db.getDeck(deckId);
  const deckConfig = db.getDeckConfigForDeck(deckId);
  
  // State for editable values
  const [newPerDay, setNewPerDay] = useState(String(deckConfig?.new?.perDay ?? 20));
  const [revPerDay, setRevPerDay] = useState(String(deckConfig?.rev?.perDay ?? 200));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!deckConfig) {
      Alert.alert('Error', 'Deck configuration not found');
      return;
    }

    const newPerDayNum = parseInt(newPerDay, 10);
    const revPerDayNum = parseInt(revPerDay, 10);

    if (isNaN(newPerDayNum) || newPerDayNum < 0) {
      Alert.alert('Invalid Input', 'New cards per day must be a positive number');
      return;
    }

    if (isNaN(revPerDayNum) || revPerDayNum < 0) {
      Alert.alert('Invalid Input', 'Reviews per day must be a positive number');
      return;
    }

    try {
      setSaving(true);

      // Update deck config
      deckConfig.new.perDay = newPerDayNum;
      deckConfig.rev.perDay = revPerDayNum;

      // Save to database
      await PersistenceService.save(db);
      
      logger.info(`[DeckSettings] Updated deck config for ${deck?.name}: new/day=${newPerDayNum}, rev/day=${revPerDayNum}`);
      
      Alert.alert('Success', 'Deck settings saved', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      logger.error('[DeckSettings] Error saving:', error);
      Alert.alert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!deck || !deckConfig) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <Text style={[styles.errorText, { color: theme.colors.textPrimary }]}>
          Deck not found
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            { opacity: pressed ? 0.5 : 1 },
          ]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.textPrimary }]} numberOfLines={1}>
          Deck Settings
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Deck Name */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface2 }]}>
          <Text style={[styles.deckName, { color: theme.colors.textHigh }]}>
            {deck.name.split('::').pop()}
          </Text>
        </View>

        {/* Daily Limits */}
        <View style={[styles.section, { backgroundColor: theme.colors.surface2 }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textHigh }]}>
            Daily Limits
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.textMed }]}>
            Control how many cards you see each day
          </Text>

          {/* New Cards Per Day */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingLabelText, { color: theme.colors.textPrimary }]}>
                New cards per day
              </Text>
              <Text style={[styles.settingHint, { color: theme.colors.textSecondary }]}>
                Maximum new cards to introduce daily
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                },
              ]}
              value={newPerDay}
              onChangeText={setNewPerDay}
              keyboardType="number-pad"
              placeholder="20"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>

          {/* Reviews Per Day */}
          <View style={styles.settingRow}>
            <View style={styles.settingLabel}>
              <Text style={[styles.settingLabelText, { color: theme.colors.textPrimary }]}>
                Reviews per day
              </Text>
              <Text style={[styles.settingHint, { color: theme.colors.textSecondary }]}>
                Maximum reviews to complete daily
              </Text>
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.textPrimary,
                  borderColor: theme.colors.border,
                },
              ]}
              value={revPerDay}
              onChangeText={setRevPerDay}
              keyboardType="number-pad"
              placeholder="200"
              placeholderTextColor={theme.colors.textSecondary}
            />
          </View>
        </View>

        {/* Info Box */}
        <View style={[styles.infoBox, { backgroundColor: theme.colors.surface2 }]}>
          <Ionicons name="information-circle" size={20} color={theme.colors.accent} />
          <Text style={[styles.infoText, { color: theme.colors.textMed }]}>
            Learning cards are always shown and don't count toward daily limits.
          </Text>
        </View>

        {/* Save Button */}
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: theme.colors.accent,
              opacity: pressed || saving ? 0.7 : 1,
            },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveButtonText, { color: '#FFFFFF' }]}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Text>
        </Pressable>
      </ScrollView>
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
    paddingHorizontal: s.md,
    paddingVertical: s.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 60,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: s.md,
    gap: s.md,
  },
  section: {
    padding: s.lg,
    borderRadius: r.lg,
    gap: s.md,
  },
  deckName: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionDescription: {
    fontSize: 14,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: s.md,
    marginTop: s.sm,
  },
  settingLabel: {
    flex: 1,
  },
  settingLabelText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 2,
  },
  settingHint: {
    fontSize: 12,
  },
  input: {
    width: 80,
    height: 44,
    borderWidth: 1,
    borderRadius: r.md,
    paddingHorizontal: s.md,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: s.sm,
    padding: s.md,
    borderRadius: r.md,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    padding: s.lg,
    borderRadius: r.lg,
    alignItems: 'center',
    marginTop: s.md,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    padding: s.xl,
  },
});
