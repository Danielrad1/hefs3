import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export default function WelcomeScreen({ onGetStarted, onSignIn }: WelcomeScreenProps) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Hero Section */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.hero}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../../../assets/enqode_main_transparent.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          
          <Text style={[styles.appName, { color: theme.colors.textPrimary }]}>
            enqode
          </Text>
          <Text style={[styles.tagline, { color: theme.colors.textSecondary }]}>
            memorize anything
          </Text>
        </Animated.View>

        {/* Benefits */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.benefits}>
          <BenefitItem
            icon="trending-up"
            text="Science-backed learning"
            theme={theme}
          />
          <BenefitItem
            icon="stats-chart"
            text="Track your progress"
            theme={theme}
          />
          <BenefitItem
            icon="flash"
            text="Study smarter, not harder"
            theme={theme}
          />
        </Animated.View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Animated.View entering={FadeInDown.delay(300)}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                { 
                  backgroundColor: theme.colors.accent,
                  opacity: pressed ? 0.8 : 1,
                }
              ]}
              onPress={onGetStarted}
            >
              <Text style={styles.primaryButtonText}>
                GET STARTED
              </Text>
            </Pressable>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(350)}>
            <Pressable
              style={styles.secondaryButton}
              onPress={onSignIn}
            >
              <Text style={[styles.secondaryButtonText, { color: theme.colors.accent }]}>
                I ALREADY HAVE AN ACCOUNT
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </SafeAreaView>
  );
}

interface BenefitItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  theme: any;
}

function BenefitItem({ icon, text, theme }: BenefitItemProps) {
  return (
    <View style={styles.benefitItem}>
      <Ionicons name={icon} size={24} color={theme.colors.accent} />
      <Text style={[styles.benefitText, { color: theme.colors.textPrimary }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: s.xl,
    paddingTop: s.xl * 3,
    paddingBottom: s.xl * 2,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: s.lg,
  },
  logoContainer: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.lg,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  appName: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: s.lg,
    fontWeight: '500',
  },
  benefits: {
    gap: s.lg,
    paddingVertical: s.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: s.lg,
    paddingHorizontal: s.md,
  },
  benefitText: {
    fontSize: 17,
    fontWeight: '600',
  },
  ctaSection: {
    gap: s.lg,
  },
  primaryButton: {
    paddingVertical: s.lg + 2,
    borderRadius: r.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
    shadowColor: '#6EE7F2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A0A0B',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    paddingVertical: s.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
