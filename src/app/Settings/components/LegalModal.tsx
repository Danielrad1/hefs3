import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../design/theme';
import { s } from '../../../design/spacing';
import { r } from '../../../design/radii';

interface LegalModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

export default function LegalModal({ visible, onClose, type }: LegalModalProps) {
  const theme = useTheme();

  const privacyContent = {
    title: 'Privacy Policy',
    lastUpdated: 'October 17, 2025',
    sections: [
      {
        heading: 'Summary',
        content: 'Enqode collects only what\'s needed to provide the flashcard app, including account info, study progress, and deck content. We don\'t sell personal data.',
      },
      {
        heading: 'Information We Collect',
        content: 'Account info: email/name (from Sign in with Apple/Google)\n\nUsage: study progress, deck/cards you create/import\n\nPurchases: subscription status and purchase history (via RevenueCat)\n\nIdentifiers: user ID, device push token (for notifications)\n\nOptional media: photos, camera, microphone when you attach media to cards',
      },
      {
        heading: 'How We Use Information',
        content: 'Provide and improve app functionality (spaced repetition, stats, backups)\n\nProcess subscriptions and restore purchases\n\nSend optional notifications/reminders you enable\n\nProtect security and prevent fraud',
      },
      {
        heading: 'User Content',
        content: 'You control the content you create/import. You must own or have rights to any third‑party content you upload or import into Enqode.',
      },
      {
        heading: 'Third‑Party Services',
        content: 'Firebase (Authentication, Functions/Storage)\n\nRevenueCat (subscription management)\n\nOpenAI (AI generation for hints/deck creation). Your prompts/content may be sent to the provider solely to fulfill your request.\n\nEach maintains its own privacy policy and compliance.',
      },
      {
        heading: 'Data Sharing',
        content: 'We do not sell personal data. We share only with service providers above to operate the app, or as required by law.',
      },
      {
        heading: 'Data Retention',
        content: 'We retain data while your account is active. You can request export or deletion through Settings or by contacting us. Legal obligations may require limited retention after deletion.',
      },
      {
        heading: 'Your Rights',
        content: 'Access, correct, export, or delete your data by contacting us or using in‑app controls where available.',
      },
      {
        heading: 'Children\'s Privacy',
        content: 'Enqode is intended for users 13+. We do not knowingly collect data from children under 13.',
      },
      {
        heading: 'Security',
        content: 'We use industry‑standard security and encryption. No method is 100% secure.',
      },
      {
        heading: 'Changes',
        content: 'We\'ll update this policy as needed and indicate the latest date.',
      },
      {
        heading: 'Contact',
        content: 'enqodeapp@gmail.com\n\nNote: This is non‑legal guidance. Consider legal review for your jurisdiction(s).',
      },
    ],
  };

  const termsContent = {
    title: 'Terms of Use',
    lastUpdated: 'October 17, 2025',
    sections: [
      {
        heading: 'Acceptance of Terms',
        content: 'By using Enqode, you agree to these Terms. If you disagree, do not use the app.',
      },
      {
        heading: 'License',
        content: 'We grant a personal, non‑transferable license to use Enqode for learning. No reverse engineering or unauthorized distribution.',
      },
      {
        heading: 'User Accounts',
        content: 'You\'re responsible for maintaining your account security and accurate information.',
      },
      {
        heading: 'Subscription & Billing',
        content: 'Enqode Pro is auto‑renewing. Manage/cancel via your Apple ID. Partial‑period refunds are not provided. Prices may change with notice.',
      },
      {
        heading: 'User Content and IP Rights',
        content: 'You retain ownership of your content. You grant Enqode a limited license to store/process your content only to provide the service.\n\nYou represent you own or have rights to all content you upload/import and that it doesn\'t infringe third‑party rights or laws.',
      },
      {
        heading: 'Acceptable Use',
        content: 'No illegal activity, harassment, IP infringement, malware, scraping, or unauthorized access attempts.',
      },
      {
        heading: 'Third‑Party Services',
        content: 'We integrate with Firebase, RevenueCat, and AI providers. Their terms/policies apply to their services.',
      },
      {
        heading: 'Termination',
        content: 'We may suspend/terminate for violations. After termination, we may delete data following retention policies. You can export your data before deletion where available.',
      },
      {
        heading: 'Disclaimers',
        content: 'Enqode is provided "as is" without warranties. We don\'t guarantee error‑free operation or specific outcomes.',
      },
      {
        heading: 'Limitation of Liability',
        content: 'To the fullest extent permitted by law, Enqode and its developers are not liable for indirect, incidental, or consequential damages.',
      },
      {
        heading: 'Changes to Terms',
        content: 'We may update these Terms; continued use means acceptance of changes.',
      },
      {
        heading: 'Contact',
        content: 'enqodeapp@gmail.com',
      },
    ],
  };

  const content = type === 'privacy' ? privacyContent : termsContent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[styles.modalContainer, { backgroundColor: theme.colors.surface2 }]}
        >
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.headerLeft}>
              <Ionicons
                name={type === 'privacy' ? 'shield-checkmark' : 'document-text'}
                size={24}
                color={theme.colors.primary}
              />
              <View>
                <Text style={[styles.title, { color: theme.colors.textHigh }]}>
                  {content.title}
                </Text>
                <Text style={[styles.lastUpdated, { color: theme.colors.textLow }]}>
                  Last updated: {content.lastUpdated}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={theme.colors.textMed} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={true}
          >
            {content.sections.map((section, index) => (
              <View key={index} style={styles.section}>
                <Text style={[styles.sectionHeading, { color: theme.colors.textHigh }]}>
                  {section.heading}
                </Text>
                <Text style={[styles.sectionContent, { color: theme.colors.textMed }]}>
                  {section.content}
                </Text>
              </View>
            ))}

            <View style={[styles.footer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Ionicons name="mail" size={20} color={theme.colors.textMed} />
              <Text style={[styles.footerText, { color: theme.colors.textMed }]}>
                Questions? Contact us at enqodeapp@gmail.com
              </Text>
            </View>
          </ScrollView>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    width: '100%',
    height: '90%',
    borderTopLeftRadius: r.xl,
    borderTopRightRadius: r.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: s.lg,
    paddingBottom: s.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.md,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  lastUpdated: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: s.lg,
    paddingTop: s.md,
    paddingBottom: s['2xl'],
  },
  section: {
    marginBottom: s.xl,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: s.sm,
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.sm,
    padding: s.md,
    borderRadius: r.md,
    borderWidth: 1,
    marginTop: s.md,
  },
  footerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
});
