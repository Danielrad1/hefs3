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
        heading: 'Information We Collect',
        content: 'Memorize collects minimal information necessary to provide our flashcard service. This includes your account information (email address), study progress, and deck data. All data is stored securely and encrypted.',
      },
      {
        heading: 'How We Use Your Data',
        content: 'Your data is used solely to provide and improve the Memorize app experience. We use your study history to calculate statistics and optimize spaced repetition algorithms. We never sell your personal information to third parties.',
      },
      {
        heading: 'Data Storage',
        content: 'All user data is stored securely using industry-standard encryption. Your flashcard content and study progress are stored on secure servers and backed up regularly. You can export or delete your data at any time from the Settings page.',
      },
      {
        heading: 'Third-Party Services',
        content: 'Memorize uses Firebase for authentication and cloud storage. These services are GDPR and CCPA compliant and maintain their own privacy policies. We do not share your data with any other third parties.',
      },
      {
        heading: 'Your Rights',
        content: 'You have the right to access, modify, or delete your personal data at any time. You can export all your data or request complete account deletion from the Settings page. For privacy concerns, contact us at privacy@memorizeapp.com.',
      },
      {
        heading: 'Children\'s Privacy',
        content: 'Memorize is intended for users 13 years and older. We do not knowingly collect information from children under 13. If we become aware of such data collection, we will delete it immediately.',
      },
      {
        heading: 'Changes to Privacy Policy',
        content: 'We may update this privacy policy from time to time. We will notify you of any material changes by posting the new policy in the app and updating the "Last Updated" date.',
      },
    ],
  };

  const termsContent = {
    title: 'Terms & Conditions',
    lastUpdated: 'October 17, 2025',
    sections: [
      {
        heading: 'Acceptance of Terms',
        content: 'By accessing and using Memorize, you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use the app.',
      },
      {
        heading: 'License to Use',
        content: 'Memorize grants you a personal, non-exclusive, non-transferable license to use the app for your personal learning purposes. You may not copy, modify, distribute, or reverse engineer any part of the app.',
      },
      {
        heading: 'User Content',
        content: 'You retain all rights to the flashcard content you create. By using Memorize, you grant us a license to store and process your content to provide the service. You are responsible for ensuring your content does not violate any laws or third-party rights.',
      },
      {
        heading: 'Prohibited Uses',
        content: 'You may not use Memorize to: (a) violate any laws, (b) infringe on intellectual property rights, (c) transmit harmful code or malware, (d) harass or harm others, (e) attempt to gain unauthorized access to our systems, or (f) use automated systems to access the service.',
      },
      {
        heading: 'Subscription & Payments',
        content: 'Memorize Pro is a subscription service with recurring billing. You can cancel at any time, but refunds are not provided for partial subscription periods. Subscription prices may change with 30 days notice.',
      },
      {
        heading: 'Disclaimer of Warranties',
        content: 'Memorize is provided "as is" without warranties of any kind. We do not guarantee that the app will be error-free, uninterrupted, or meet your specific requirements. You use the app at your own risk.',
      },
      {
        heading: 'Limitation of Liability',
        content: 'Memorize and its developers shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the app, including loss of data or study progress.',
      },
      {
        heading: 'Termination',
        content: 'We reserve the right to suspend or terminate your account at any time for violation of these terms. Upon termination, you may export your data within 30 days, after which it may be permanently deleted.',
      },
      {
        heading: 'Changes to Terms',
        content: 'We may modify these terms at any time. Continued use of the app after changes constitutes acceptance of the new terms. Material changes will be communicated through the app.',
      },
      {
        heading: 'Contact',
        content: 'For questions about these terms, contact us at legal@memorizeapp.com.',
      },
    ],
  };

  const content = type === 'privacy' ? privacyContent : termsContent;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.modalContainer, { backgroundColor: theme.colors.surface2 }]}
          onStartShouldSetResponder={() => true}
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
                Questions? Contact us at {type === 'privacy' ? 'privacy' : 'legal'}@memorizeapp.com
              </Text>
            </View>
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: s.lg,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '85%',
    borderRadius: r.xl,
    overflow: 'hidden',
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
    lineHeight: 20,
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
