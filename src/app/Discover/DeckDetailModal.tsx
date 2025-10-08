import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import { DeckManifest } from '../../services/discover/DiscoverService';

interface DeckDetailModalProps {
  deck: DeckManifest | null;
  visible: boolean;
  onClose: () => void;
  onDownload: (deck: DeckManifest) => void;
  downloading: boolean;
  downloadProgress: number;
  importing: boolean;
  importProgress: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
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
}: DeckDetailModalProps) {
  const theme = useTheme();

  if (!deck) return null;

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
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
              <Ionicons name={icon} size={48} color={iconColor} />
            </View>

            {/* Title */}
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {deck.name}
            </Text>

            {/* Description */}
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>
              {deck.description}
            </Text>

            {/* Metadata */}
            <View style={styles.metadata}>
              <View style={styles.metaRow}>
                <Ionicons name="layers" size={20} color={theme.colors.textTertiary} />
                <Text style={[styles.metaText, { color: theme.colors.textPrimary }]}>
                  {deck.cardCount} cards
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="language" size={20} color={theme.colors.textTertiary} />
                <Text style={[styles.metaText, { color: theme.colors.textPrimary }]}>
                  {deck.language}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="download" size={20} color={theme.colors.textTertiary} />
                <Text style={[styles.metaText, { color: theme.colors.textPrimary }]}>
                  {sizeInMB} MB
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="bar-chart" size={20} color={theme.colors.textTertiary} />
                <View style={[styles.difficultyBadge, { backgroundColor: difficultyColor + '20' }]}>
                  <Text style={[styles.difficultyText, { color: difficultyColor }]}>
                    {deck.difficulty}
                  </Text>
                </View>
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
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    maxHeight: '85%',
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
    paddingHorizontal: s.xl,
    paddingBottom: s.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: r.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: s.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: s.sm,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: s.xl,
  },
  metadata: {
    gap: s.md,
    marginBottom: s.xl,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
  },
  metaText: {
    fontSize: 16,
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: s.sm,
    paddingVertical: s.xs / 2,
    borderRadius: r.sm,
  },
  difficultyText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
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
