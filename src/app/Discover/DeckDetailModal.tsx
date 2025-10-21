import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { DeckManifest } from '../../services/discover/DiscoverService';
import { buildDeckTheme, getDeckGlyphs } from './DeckTheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DeckDetailModalProps {
  deck: DeckManifest | null;
  visible: boolean;
  onClose: () => void;
  onDownload: (deck: DeckManifest) => void;
  downloading: boolean;
  downloadProgress: number;
  importing: boolean;
  importProgress: string;
  icon: string;
  iconColor: string;
  sampleCards?: Array<{ front: string; back: string }>;
}

export function DeckDetailModal({
  deck,
  visible,
  onClose,
  onDownload,
  downloading,
  downloadProgress,
  importing,
  importProgress,
  icon,
  iconColor,
  sampleCards = [
    { front: 'Sample Question', back: 'Sample Answer' },
    { front: 'Example Term', back: 'Definition' },
  ],
}: DeckDetailModalProps) {
  const theme = useTheme();
  const [showingCardSide, setShowingCardSide] = useState<'front' | 'back'>('front');

  if (!deck) return null;

  const deckTheme = buildDeckTheme(deck);
  const glyphs = getDeckGlyphs(deck);
  const difficultyColor = deck.difficulty === 'beginner' ? '#10B981' : deck.difficulty === 'intermediate' ? '#F59E0B' : '#EF4444';
  const sizeInMB = (deck.size / 1024 / 1024).toFixed(1);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={[styles.modal, { backgroundColor: theme.colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Hero Section with Gradient */}
            <LinearGradient
              colors={deckTheme.colors}
              start={{ x: deckTheme.angle.x, y: 0 }}
              end={{ x: 1 - deckTheme.angle.x, y: 1 }}
              style={styles.heroSection}
            >
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={styles.heroOverlay}
              />
              
              {/* Icon */}
              <View style={styles.heroIcon}>
                {glyphs.primary.kind === 'icon' ? (
                  <Ionicons name={glyphs.primary.value as any} size={64} color="#FFFFFF" />
                ) : (
                  <Text style={styles.heroEmoji}>{glyphs.primary.value}</Text>
                )}
              </View>

              {/* Title */}
              <Text style={styles.heroTitle}>
                {deck.name}
              </Text>

              {/* Meta Row */}
              <View style={styles.heroMeta}>
                <View style={styles.heroMetaItem}>
                  <Ionicons name="layers" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.heroMetaText}>{deck.cardCount}</Text>
                </View>
                <View style={styles.heroDivider} />
                <View style={styles.heroMetaItem}>
                  <Ionicons name="time" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.heroMetaText}>{Math.ceil(deck.cardCount / 20)} min</Text>
                </View>
                <View style={styles.heroDivider} />
                <Text style={styles.heroMetaText}>
                  {deck.difficulty === 'beginner' ? 'Easy' : deck.difficulty === 'intermediate' ? 'Med' : 'Hard'}
                </Text>
              </View>
            </LinearGradient>

            {/* Description */}
            <View style={styles.descriptionSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                About This Deck
              </Text>
              <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
                {deck.description}
              </Text>
            </View>

            {/* Details Grid */}
            <View style={styles.detailsGrid}>
              <View style={[styles.detailCard, { backgroundColor: theme.colors.bg }]}>
                <Ionicons name="language" size={24} color={theme.colors.accent} />
                <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>Language</Text>
                <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]}>{deck.language}</Text>
              </View>
              <View style={[styles.detailCard, { backgroundColor: theme.colors.bg }]}>
                <Ionicons name="download" size={24} color={theme.colors.accent} />
                <Text style={[styles.detailLabel, { color: theme.colors.textTertiary }]}>Size</Text>
                <Text style={[styles.detailValue, { color: theme.colors.textPrimary }]}>{sizeInMB} MB</Text>
              </View>
            </View>

            {/* Tags */}
            {deck.tags && deck.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                <Text style={[styles.tagsLabel, { color: theme.colors.textSecondary }]}>
                  Tags
                </Text>
                <View style={styles.tags}>
                  {deck.tags.map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: theme.colors.bg }]}>
                      <Text style={[styles.tagText, { color: theme.colors.textSecondary }]}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Author */}
            {deck.author && (
              <Text style={[styles.author, { color: theme.colors.textTertiary }]}>
                By {deck.author}
              </Text>
            )}
          </ScrollView>

          {/* Download Button */}
          <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
            <Pressable
              style={[
                styles.downloadButton,
                { backgroundColor: downloading || importing ? theme.colors.bg : theme.colors.accent },
              ]}
              onPress={() => onDownload(deck)}
              disabled={downloading || importing}
            >
              {downloading || importing ? (
                <View style={styles.progressContainer}>
                  {downloadProgress > 0 && downloadProgress < 100 ? (
                    <>
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                      <Text style={[styles.buttonText, { color: theme.colors.accent }]}>
                        Downloading {Math.round(downloadProgress)}%
                      </Text>
                    </>
                  ) : importing ? (
                    <>
                      <ActivityIndicator size="small" color={theme.colors.accent} />
                      <Text style={[styles.buttonText, { color: theme.colors.accent }]}>
                        {importProgress || 'Importing...'}
                      </Text>
                    </>
                  ) : (
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                  )}
                </View>
              ) : (
                <>
                  <Ionicons name="download" size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Download Deck</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: s.md,
  },
  closeButton: {
    padding: s.xs,
  },
  content: {
    paddingBottom: s.xl,
  },
  heroSection: {
    paddingHorizontal: 24,
    paddingVertical: 32,
    alignItems: 'center',
    marginBottom: 24,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  heroIcon: {
    marginBottom: 16,
  },
  heroEmoji: {
    fontSize: 64,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '600',
  },
  heroDivider: {
    width: 1,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  previewSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  previewCard: {
    padding: 24,
    borderRadius: 16,
    minHeight: 180,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSideIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  cardSideText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  previewCardText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 28,
  },
  tapToFlip: {
    fontSize: 12,
    marginTop: 16,
  },
  descriptionSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  detailsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  detailCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  tagsContainer: {
    marginBottom: s.lg,
  },
  tagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: s.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.xs,
  },
  tag: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs / 2,
    borderRadius: r.sm,
  },
  tagText: {
    fontSize: 12,
  },
  author: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    padding: s.lg,
    borderTopWidth: 1,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: s.lg,
    borderRadius: r.md,
    gap: s.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
});
