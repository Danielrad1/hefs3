import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import LegalModal from '../../app/Settings/components/LegalModal';
import { usePremium } from '../../context/PremiumContext';
import { useHaptics } from '../../hooks/useHaptics';
import { logger } from '../../utils/logger';

type Props = {
  visible: boolean;
  onClose: () => void;
  onRestore?: () => void;
  context?: 'hints' | 'deck';
};

export default function PremiumUpsellModal({ visible, onClose, onRestore, context }: Props) {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalContent, setLegalContent] = useState<'terms' | 'privacy' | null>(null);
  const [plan] = useState<'monthly'>('monthly');
  const [legalOpen, setLegalOpen] = useState<null | 'privacy' | 'terms'>(null);
  const { usage, subscribe, restore, monthlyPackage } = usePremium();
  const haptics = useHaptics();

  useEffect(() => {
    if (visible) {
      logger.info('[Paywall] view', { context, planDefault: plan });
    }
  }, [visible, context, plan]);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      logger.info('[Paywall] cta_tap', { plan });
      await subscribe();
      haptics.success();
      onClose();
    } catch (error: any) {
      // Don't show error UI for user cancellation
      if (error?.message !== 'cancelled') {
        haptics.warning();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      logger.info('[Paywall] restore_tap');
      await restore();
      haptics.success();
      onClose();
    } catch (error) {
      haptics.warning();
    } finally {
      setRestoring(false);
    }
  };

  const handleClose = () => {
    logger.info('[Paywall] close');
    onClose();
  };


  const usageBanner = useMemo(() => {
    if (!usage) return null;
    const hintMaxed = usage.hintGenerations >= usage.limits.hints;
    const deckMaxed = usage.deckGenerations >= usage.limits.deck;
    if (context === 'hints' || hintMaxed) {
      return 'You\'ve used your free hint this month. Go unlimited with Pro.';
    }
    if (context === 'deck' || deckMaxed) {
      return `You\'ve used your ${usage.limits.deck} free deck generations. Keep building with Pro.`;
    }
    return null;
  }, [usage, context]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {/* Close button */}
          <Pressable onPress={handleClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close">
            <Ionicons name="close" size={24} color={theme.colors.textSecondary} />
          </Pressable>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero */}
            <View style={styles.hero}>
              <Text style={[styles.mainTitle, { color: theme.colors.textPrimary }]}>
                Ace more questions.{'\n'}In less time.
              </Text>
              {usageBanner && (
                <View style={[styles.banner, { backgroundColor: theme.colors.primary + '15', borderColor: theme.colors.primary + '30' }]}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.bannerText, { color: theme.colors.textPrimary }]}>{usageBanner}</Text>
                </View>
              )}
            </View>

            {/* Proof (MCAT) */}
            <View style={[styles.proofBox, { backgroundColor: theme.colors.surface2, borderColor: theme.colors.border }]}>
              <View style={styles.proofBadge}>
                <Ionicons name="trophy" size={14} color={theme.colors.accent} />
                <Text style={[styles.proofBadgeText, { color: theme.colors.accent }]}>PROVEN RESULTS</Text>
              </View>
              <Text style={[styles.proofHeadline, { color: theme.colors.textPrimary }]}>
                MCAT learners mastered material
              </Text>
              <Text style={[styles.proofStat, { color: theme.colors.success }]}>
                28% faster
              </Text>
              <Text style={[styles.proofSubtext, { color: theme.colors.textSecondary }]}>
                vs. the top flashcard app
              </Text>
            </View>
            {/* Why Premium Works */}
            <View style={styles.benefitsSection}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
                Why Premium Works
              </Text>
              <BenefitItem 
                icon="checkmark-circle"
                title="Remember more on test day"
                subtitle="Timed, targeted hints strengthen weak links."
                theme={theme}
              />
              <BenefitItem 
                icon="rocket"
                title="Cut prep time"
                subtitle="AI builds high-quality cards from your notes in minutes."
                theme={theme}
              />
              <BenefitItem 
                icon="trending-up"
                title="Study when it sticks"
                subtitle="Peak hours and fatigue signals make sessions count."
                theme={theme}
              />
              <BenefitItem 
                icon="eye"
                title="Focus longer"
                subtitle="Low-fatigue visuals reduce cognitive load."
                theme={theme}
              />
            </View>

            {/* Extras */}
            
            <View style={styles.extrasSection}>
              <Text style={[styles.extrasLabel, { color: theme.colors.textMed }]}>
                Everything in Pro also includes
              </Text>
              <View style={styles.extrasGrid}>
                <ExtraItem icon="chatbubble-ellipses-outline" text="Priority support" theme={theme} />
                <ExtraItem icon="star-outline" text="First access to new features" theme={theme} />
              </View>
            </View>

            {/* Pricing */}
            <View style={[styles.pricingBox, { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.border }]}>
              {monthlyPackage ? (
                <>
                  <Text style={[styles.price, { color: theme.colors.textPrimary }]}>
                    {monthlyPackage.product.priceString}<Text style={styles.priceMonth}>/month</Text>
                  </Text>
                  <Text style={[styles.trial, { color: theme.colors.textMed }]}>
                    Cancel anytime
                  </Text>
                </>
              ) : (
                <ActivityIndicator color={theme.colors.primary} />
              )}
            </View>

            {/* Legal */}
            <View style={styles.legalRow}>
              <Pressable onPress={() => setLegalOpen('terms')} accessibilityRole="button">
                <Text style={[styles.legalLink, { color: theme.colors.textLow }]}>Terms</Text>
              </Pressable>
              <Text style={[styles.legalDot, { color: theme.colors.textLow }]}>•</Text>
              <Pressable onPress={() => setLegalOpen('privacy')} accessibilityRole="button">
                <Text style={[styles.legalLink, { color: theme.colors.textLow }]}>Privacy</Text>
              </Pressable>
              <Text style={[styles.legalDot, { color: theme.colors.textLow }]}>•</Text>
              <Pressable onPress={handleRestore} accessibilityRole="button" disabled={restoring}>
                <Text style={[styles.legalLink, { color: theme.colors.textLow }]}>
                  {restoring ? 'Restoring...' : 'Restore'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* CTA */}
          <View style={styles.footer}>
            <Pressable 
              onPress={handleSubscribe} 
              accessibilityRole="button"
              style={[styles.subscribeBtn, { backgroundColor: theme.colors.primary, opacity: loading || !monthlyPackage ? 0.6 : 1 }]}
              disabled={loading || !monthlyPackage}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color={theme.colors.onPrimary} />
                  <Text style={[styles.subscribeBtnText, { color: theme.colors.onPrimary }]}>Subscribe Now</Text>
                </>
              )}
            </Pressable>
            <Text style={[styles.ctaSubtext, { color: theme.colors.textLow }]}>
              {monthlyPackage ? `${monthlyPackage.product.priceString}/month • ` : ''}Cancel anytime • Secure billing
            </Text>
          </View>
          {!!legalOpen && (
            <LegalModal visible={true} onClose={() => setLegalOpen(null)} type={legalOpen} />
          )}
        </View>
      </View>
    </Modal>
  );
}

// Helper components
function BenefitItem({
  icon,
  title,
  subtitle,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  theme: any;
}) {
  return (
    <View style={helperStyles.benefitItem}>
      <View style={[helperStyles.benefitIcon, { backgroundColor: theme.colors.accent + '15' }]}>
        <Ionicons name={icon} size={20} color={theme.colors.accent} />
      </View>
      <View style={helperStyles.benefitCopy}>
        <Text style={[helperStyles.benefitTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
        <Text style={[helperStyles.benefitSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function ExtraItem({ icon, text, theme }: { icon: keyof typeof Ionicons.glyphMap; text: string; theme: any }) {
  return (
    <View style={[helperStyles.extraItem, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface2 }]}>
      <Ionicons name={icon} size={16} color={theme.colors.textMed} />
      <Text style={[helperStyles.extraText, { color: theme.colors.textMed }]}>{text}</Text>
    </View>
  );
}

const helperStyles = StyleSheet.create({
  benefitItem: {
    flexDirection: 'row',
    gap: s.md,
    marginBottom: s.md,
    alignItems: 'flex-start',
  },
  benefitIcon: {
    width: 44,
    height: 44,
    borderRadius: r.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitCopy: {
    flex: 1,
    gap: s.xs,
  },
  benefitTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  benefitSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  extraItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    borderWidth: 1,
    borderRadius: r.lg,
    paddingVertical: s.md,
    paddingHorizontal: s.lg,
  },
  extraText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '90%',
    borderTopLeftRadius: r['2xl'],
    borderTopRightRadius: r['2xl'],
    borderWidth: 1,
    paddingTop: s.xl,
    paddingBottom: s.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: s.md,
    right: s.md,
    zIndex: 10,
    padding: s.sm,
  },
  scrollView: {
    paddingHorizontal: s.xl,
  },
  scrollContent: {
    paddingBottom: s['2xl'],
  },
  hero: {
    alignItems: 'center',
    paddingTop: s.md,
    paddingBottom: s.xl,
    gap: s.sm,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    textAlign: 'center',
  },
  mainSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '500',
    opacity: 0.8,
  },
  banner: {
    marginTop: s.md,
    flexDirection: 'row',
    gap: s.xs,
    borderWidth: 1,
    paddingVertical: s.xs,
    paddingHorizontal: s.sm,
    borderRadius: r.lg,
    alignItems: 'center',
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  proofBox: {
    borderRadius: r.xl,
    paddingVertical: s['2xl'],
    paddingHorizontal: s.xl,
    marginBottom: s.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    gap: s.md,
  },
  proofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.xs / 2,
    paddingHorizontal: s.sm,
    paddingVertical: s.xs / 2,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  proofBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  proofHeadline: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  proofStat: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  proofSubtext: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.6,
  },
  benefitsSection: {
    marginBottom: s.xl,
    gap: s.sm,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: s.lg,
    letterSpacing: -0.6,
  },
  extrasSection: {
    marginBottom: s.xl,
  },
  extrasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: s.sm,
  },
  extrasLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: s.md,
  },
  pricingBox: {
    borderRadius: r.xl,
    paddingVertical: s.lg,
    paddingHorizontal: s.xl,
    alignItems: 'center',
    marginBottom: s.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  price: {
    fontSize: 42,
    fontWeight: '900',
    marginBottom: s.xs,
  },
  priceMonth: {
    fontSize: 22,
    fontWeight: '700',
  },
  trial: {
    fontSize: 16,
    fontWeight: '700',
  },
  legal: {
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginBottom: s.md,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    marginBottom: s.md,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '700',
  },
  legalDot: {
    fontSize: 12,
    opacity: 0.6,
  },
  footer: {
    paddingHorizontal: s.xl,
    paddingTop: s.lg,
    paddingBottom: s.sm,
  },
  subscribeBtn: {
    paddingVertical: 20,
    borderRadius: r.xl,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  subscribeBtnText: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  ctaSubtext: {
    marginTop: s.sm,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});
