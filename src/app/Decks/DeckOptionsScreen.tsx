/**
 * DeckOptionsScreen - Configure deck algorithm and study parameters
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { db } from '../../services/anki/InMemoryDb';
import { DeckConfig } from '../../services/anki/schema';
import { PersistenceService } from '../../services/anki/PersistenceService';

interface DeckOptionsScreenProps {
  route: {
    params: {
      deckId: string;
    };
  };
  navigation: any;
}

type AlgorithmType = 'sm2' | 'fsrs' | 'leitner' | 'ai';

const ALGORITHM_INFO = {
  sm2: {
    name: 'Classic (SM-2)',
    description: 'Traditional Anki algorithm with ease factors and learning steps. Proven and reliable.',
    icon: 'library-outline' as const,
  },
  fsrs: {
    name: 'FSRS (Smart)',
    description: 'Modern algorithm that learns from your review history. More accurate intervals.',
    icon: 'analytics-outline' as const,
  },
  leitner: {
    name: 'Leitner (Simple)',
    description: 'Simple box system with fixed intervals. Easy to understand and predict.',
    icon: 'cube-outline' as const,
  },
  ai: {
    name: 'AI Optimized (Auto)',
    description: 'Automatically adjusts settings to meet your daily time budget and retention goals.',
    icon: 'sparkles-outline' as const,
  },
};

export default function DeckOptionsScreen({ route, navigation }: DeckOptionsScreenProps) {
  const theme = useTheme();
  const { deckId } = route.params;

  const deck = db.getDeck(deckId);
  const [deckConfig, setDeckConfig] = useState<DeckConfig | null>(null);
  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmType>('sm2');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load deck config
  useEffect(() => {
    const config = db.getDeckConfigForDeck(deckId);
    if (config) {
      setDeckConfig(config);
      setSelectedAlgo((config.algo as AlgorithmType) || 'sm2');
    }
  }, [deckId]);

  if (!deck || !deckConfig) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
        <Text style={{ color: theme.colors.textHigh }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const handleSave = async () => {
    // Update deck config with selected algorithm
    db.updateDeckConfig(deckConfig.id, {
      ...deckConfig,
      algo: selectedAlgo,
    });

    await PersistenceService.save(db);
    
    Alert.alert('Success', 'Deck options saved successfully', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const handleUpdateConfig = (updates: Partial<DeckConfig>) => {
    setDeckConfig({ ...deckConfig, ...updates });
  };

  const renderAlgorithmOption = (algo: AlgorithmType) => {
    const info = ALGORITHM_INFO[algo];
    const isSelected = selectedAlgo === algo;

    return (
      <Pressable
        key={algo}
        style={[
          styles.algoCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isSelected ? theme.colors.primary : theme.colors.border,
            borderWidth: isSelected ? 2 : 1,
          },
        ]}
        onPress={() => setSelectedAlgo(algo)}
      >
        <View style={styles.algoHeader}>
          <Ionicons name={info.icon} size={24} color={isSelected ? theme.colors.primary : theme.colors.textHigh} />
          <Text style={[styles.algoName, { color: isSelected ? theme.colors.primary : theme.colors.textHigh }]}>
            {info.name}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color={theme.colors.primary} />
          )}
        </View>
        <Text style={[styles.algoDescription, { color: theme.colors.textMed }]}>
          {info.description}
        </Text>
      </Pressable>
    );
  };

  const renderSm2Settings = () => (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textHigh }]}>SM-2 Settings</Text>

      {/* Daily Limits */}
      <Text style={[styles.subsectionTitle, { color: theme.colors.textMed }]}>Daily Limits</Text>
      
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>New cards per day</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={deckConfig.new.perDay.toString()}
          onChangeText={(text) => {
            const val = parseInt(text) || 0;
            handleUpdateConfig({ new: { ...deckConfig.new, perDay: val } });
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Reviews per day</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={deckConfig.rev.perDay.toString()}
          onChangeText={(text) => {
            const val = parseInt(text) || 0;
            handleUpdateConfig({ rev: { ...deckConfig.rev, perDay: val } });
          }}
          keyboardType="numeric"
        />
      </View>

      {/* New Cards */}
      <Text style={[styles.subsectionTitle, { color: theme.colors.textMed, marginTop: s.md }]}>New Cards</Text>
      
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Learning steps (minutes)</Text>
        <TextInput
          style={[styles.inputWide, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={deckConfig.new.delays.join(' ')}
          onChangeText={(text) => {
            const delays = text.split(' ').map(s => parseInt(s) || 0).filter(n => n > 0);
            handleUpdateConfig({ new: { ...deckConfig.new, delays } });
          }}
          placeholder="1 10"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Graduating interval (days)</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={deckConfig.new.ints[0].toString()}
          onChangeText={(text) => {
            const val = parseInt(text) || 1;
            const ints: [number, number, number] = [val, deckConfig.new.ints[1], deckConfig.new.ints[2]];
            handleUpdateConfig({ new: { ...deckConfig.new, ints } });
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Easy interval (days)</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={deckConfig.new.ints[1].toString()}
          onChangeText={(text) => {
            const val = parseInt(text) || 4;
            const ints: [number, number, number] = [deckConfig.new.ints[0], val, deckConfig.new.ints[2]];
            handleUpdateConfig({ new: { ...deckConfig.new, ints } });
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>New card order</Text>
        <Pressable
          style={[styles.picker, { borderColor: theme.colors.border }]}
          onPress={() => {
            const newOrder = deckConfig.new.order === 0 ? 1 : 0;
            handleUpdateConfig({ new: { ...deckConfig.new, order: newOrder } });
          }}
        >
          <Text style={[styles.pickerText, { color: theme.colors.textHigh }]}>
            {deckConfig.new.order === 0 ? 'Sequential' : 'Random'}
          </Text>
        </Pressable>
      </View>

      {/* Review Settings */}
      <Text style={[styles.subsectionTitle, { color: theme.colors.textMed, marginTop: s.md }]}>Reviews</Text>
      
      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Interval modifier (%)</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={(deckConfig.rev.ivlFct * 100).toFixed(0)}
          onChangeText={(text) => {
            const val = Math.max(0, parseInt(text) || 100) / 100;
            handleUpdateConfig({ rev: { ...deckConfig.rev, ivlFct: val } });
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Easy bonus (%)</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={(deckConfig.rev.ease4 / 10).toFixed(0)}
          onChangeText={(text) => {
            const val = Math.max(0, parseInt(text) || 15) * 10;
            handleUpdateConfig({ rev: { ...deckConfig.rev, ease4: val } });
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Maximum interval (days)</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={deckConfig.rev.maxIvl.toString()}
          onChangeText={(text) => {
            const val = parseInt(text) || 36500;
            handleUpdateConfig({ rev: { ...deckConfig.rev, maxIvl: val } });
          }}
          keyboardType="numeric"
        />
      </View>

      {showAdvanced && (
        <>
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Fuzz factor (%)</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
              value={(deckConfig.rev.fuzz * 100).toFixed(0)}
              onChangeText={(text) => {
                const val = Math.max(0, Math.min(100, parseInt(text) || 5)) / 100;
                handleUpdateConfig({ rev: { ...deckConfig.rev, fuzz: val } });
              }}
              keyboardType="numeric"
            />
          </View>

          {/* Lapses */}
          <Text style={[styles.subsectionTitle, { color: theme.colors.textMed, marginTop: s.md }]}>Lapses</Text>
          
          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Relearning steps (min)</Text>
            <TextInput
              style={[styles.inputWide, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
              value={deckConfig.lapse.delays.join(' ')}
              onChangeText={(text) => {
                const delays = text.split(' ').map(s => parseInt(s) || 0).filter(n => n > 0);
                handleUpdateConfig({ lapse: { ...deckConfig.lapse, delays } });
              }}
              placeholder="10"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Lapse interval mult (%)</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
              value={(deckConfig.lapse.mult * 100).toFixed(0)}
              onChangeText={(text) => {
                const val = Math.max(0, parseInt(text) || 50) / 100;
                handleUpdateConfig({ lapse: { ...deckConfig.lapse, mult: val } });
              }}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Minimum interval (days)</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
              value={deckConfig.lapse.minInt.toString()}
              onChangeText={(text) => {
                const val = Math.max(1, parseInt(text) || 1);
                handleUpdateConfig({ lapse: { ...deckConfig.lapse, minInt: val } });
              }}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Leech threshold</Text>
            <TextInput
              style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
              value={deckConfig.lapse.leechFails.toString()}
              onChangeText={(text) => {
                const val = Math.max(1, parseInt(text) || 8);
                handleUpdateConfig({ lapse: { ...deckConfig.lapse, leechFails: val } });
              }}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.settingRow}>
            <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Leech action</Text>
            <Pressable
              style={[styles.picker, { borderColor: theme.colors.border }]}
              onPress={() => {
                const newAction = deckConfig.lapse.leechAction === 0 ? 1 : 0;
                handleUpdateConfig({ lapse: { ...deckConfig.lapse, leechAction: newAction } });
              }}
            >
              <Text style={[styles.pickerText, { color: theme.colors.textHigh }]}>
                {deckConfig.lapse.leechAction === 0 ? 'Suspend' : 'Tag Only'}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      <Pressable onPress={() => setShowAdvanced(!showAdvanced)} style={styles.advancedToggle}>
        <Text style={[styles.advancedText, { color: theme.colors.primary }]}>
          {showAdvanced ? 'Hide' : 'Show'} advanced settings
        </Text>
        <Ionicons
          name={showAdvanced ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.primary}
        />
      </Pressable>
    </View>
  );

  const renderFsrsSettings = () => (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textHigh }]}>FSRS Settings</Text>

      <Text style={[styles.helpText, { color: theme.colors.textMed }]}>
        FSRS learns from your review history to predict optimal intervals.
      </Text>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Target retention (%)</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={((deckConfig.algoParams?.fsrs?.retention || 0.9) * 100).toFixed(0)}
          onChangeText={(text) => {
            const val = Math.min(100, Math.max(70, parseInt(text) || 90)) / 100;
            handleUpdateConfig({
              algoParams: {
                ...deckConfig.algoParams,
                fsrs: { ...deckConfig.algoParams?.fsrs, retention: val },
              },
            });
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>New cards per day</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={deckConfig.new.perDay.toString()}
          onChangeText={(text) => {
            const val = parseInt(text) || 0;
            handleUpdateConfig({ new: { ...deckConfig.new, perDay: val } });
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Reviews per day</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={deckConfig.rev.perDay.toString()}
          onChangeText={(text) => {
            const val = parseInt(text) || 0;
            handleUpdateConfig({ rev: { ...deckConfig.rev, perDay: val } });
          }}
          keyboardType="numeric"
        />
      </View>

      <Text style={[styles.note, { color: theme.colors.textMed, marginTop: s.sm }]}>
        💡 Higher retention = shorter intervals (more work, better memory)
      </Text>
      <Text style={[styles.note, { color: theme.colors.textMed }]}>
        Recommended: 85-90% for most learners
      </Text>
    </View>
  );

  const renderLeitnerSettings = () => {
    const defaultIntervals = [10 / 1440, 1, 2, 4, 8, 16, 32, 64];
    const currentIntervals = deckConfig.algoParams?.leitner?.intervals || defaultIntervals;
    
    return (
      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textHigh }]}>Leitner Settings</Text>

        <Text style={[styles.helpText, { color: theme.colors.textMed }]}>
          Box system: Cards advance to higher boxes on correct answers, drop on wrong answers.
        </Text>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>New cards per day</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
            value={deckConfig.new.perDay.toString()}
            onChangeText={(text) => {
              const val = parseInt(text) || 0;
              handleUpdateConfig({ new: { ...deckConfig.new, perDay: val } });
            }}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Reviews per day</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
            value={deckConfig.rev.perDay.toString()}
            onChangeText={(text) => {
              const val = parseInt(text) || 0;
              handleUpdateConfig({ rev: { ...deckConfig.rev, perDay: val } });
            }}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Box intervals (days)</Text>
          <TextInput
            style={[styles.inputWide, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
            value={currentIntervals.map(i => i < 1 ? `${Math.round(i * 1440)}m` : i).join(' ')}
            onChangeText={(text) => {
              const intervals = text.split(' ').map(s => {
                if (s.endsWith('m')) {
                  const mins = parseInt(s) || 10;
                  return mins / 1440;
                }
                return parseFloat(s) || 1;
              }).filter(n => n > 0);
              handleUpdateConfig({
                algoParams: {
                  ...deckConfig.algoParams,
                  leitner: { intervals, dropBoxes: deckConfig.algoParams?.leitner?.dropBoxes ?? 0 },
                },
              });
            }}
            placeholder="10m 1 2 4 8 16 32 64"
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Drop boxes on wrong</Text>
          <TextInput
            style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
            value={(deckConfig.algoParams?.leitner?.dropBoxes ?? 0).toString()}
            onChangeText={(text) => {
              const val = Math.max(0, parseInt(text) || 0);
              handleUpdateConfig({
                algoParams: {
                  ...deckConfig.algoParams,
                  leitner: { intervals: currentIntervals, dropBoxes: val },
                },
              });
            }}
            keyboardType="numeric"
          />
        </View>
        
        <Text style={[styles.note, { color: theme.colors.textMed }]}>
          💡 0 = reset to box 0 on wrong; 1 = drop one box, etc.
        </Text>
      </View>
    );
  };

  const renderAiSettings = () => (
    <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textHigh }]}>AI Optimization Settings</Text>

      <Text style={[styles.helpText, { color: theme.colors.textMed }]}>
        AI mode uses FSRS and automatically adjusts your new cards per day to meet your time budget.
      </Text>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Target retention (%)</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={((deckConfig.algoParams?.ai?.retention || 0.9) * 100).toString()}
          onChangeText={(text) => {
            const val = Math.min(100, Math.max(0, parseInt(text) || 90)) / 100;
            handleUpdateConfig({
              algoParams: {
                ...deckConfig.algoParams,
                ai: { ...deckConfig.algoParams?.ai, retention: val, dailyMinutes: deckConfig.algoParams?.ai?.dailyMinutes || 15, goal: deckConfig.algoParams?.ai?.goal || 'balanced' },
              },
            });
          }}
          keyboardType="numeric"
        />
      </View>

      <View style={styles.settingRow}>
        <Text style={[styles.settingLabel, { color: theme.colors.textHigh }]}>Daily minutes budget</Text>
        <TextInput
          style={[styles.input, { color: theme.colors.textHigh, borderColor: theme.colors.border }]}
          value={(deckConfig.algoParams?.ai?.dailyMinutes || 15).toString()}
          onChangeText={(text) => {
            const val = parseInt(text) || 15;
            handleUpdateConfig({
              algoParams: {
                ...deckConfig.algoParams,
                ai: { ...deckConfig.algoParams?.ai, dailyMinutes: val, retention: deckConfig.algoParams?.ai?.retention || 0.9, goal: deckConfig.algoParams?.ai?.goal || 'balanced' },
              },
            });
          }}
          keyboardType="numeric"
        />
      </View>

      <Text style={[styles.note, { color: theme.colors.textMed }]}>
        💡 The system will auto-adjust your new cards per day to fit this budget
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={[styles.backButton, { color: theme.colors.primary }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.textHigh }]}>Study Options</Text>
        <Pressable onPress={handleSave}>
          <Text style={[styles.saveButton, { color: theme.colors.primary }]}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Deck Name */}
        <Text style={[styles.deckName, { color: theme.colors.textMed }]}>{deck.name}</Text>

        {/* Algorithm Selection */}
        <View style={styles.algoSection}>
          <Text style={[styles.algoSectionTitle, { color: theme.colors.textHigh }]}>Algorithm</Text>
          {renderAlgorithmOption('sm2')}
          {renderAlgorithmOption('fsrs')}
          {renderAlgorithmOption('leitner')}
          {renderAlgorithmOption('ai')}
        </View>

        {/* Algorithm-specific settings */}
        {selectedAlgo === 'sm2' && renderSm2Settings()}
        {selectedAlgo === 'fsrs' && renderFsrsSettings()}
        {selectedAlgo === 'leitner' && renderLeitnerSettings()}
        {selectedAlgo === 'ai' && renderAiSettings()}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: s.md,
    borderBottomWidth: 1,
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.md,
    gap: s.lg,
  },
  deckName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: s.xs,
  },
  algoSection: {
    gap: s.sm,
  },
  algoSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: s.xs,
  },
  algoCard: {
    padding: s.md,
    borderRadius: r.md,
    gap: s.xs,
  },
  algoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  algoName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  algoDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    padding: s.md,
    borderRadius: r.md,
    gap: s.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 14,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: r.sm,
    padding: s.sm,
    fontSize: 14,
    width: 80,
    textAlign: 'right',
  },
  inputWide: {
    borderWidth: 1,
    borderRadius: r.sm,
    padding: s.sm,
    fontSize: 14,
    width: 120,
    textAlign: 'right',
  },
  picker: {
    borderWidth: 1,
    borderRadius: r.sm,
    padding: s.sm,
    width: 120,
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 14,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: s.sm,
    marginBottom: s.xs,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.xs,
    marginTop: s.xs,
  },
  advancedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  helpText: {
    fontSize: 13,
    lineHeight: 18,
  },
  note: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: s.xs,
  },
});
