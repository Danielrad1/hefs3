import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../design/theme';
import { s } from '../../design/spacing';
import { r } from '../../design/radii';
import PrimaryButton from '../../components/PrimaryButton';

const { width } = Dimensions.get('window');

interface WelcomeScreenProps {
  navigation: any;
}

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const theme = useTheme();

  const handleContinue = () => {
    navigation.navigate('Profile');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        {/* Hero Section with Gradient Background */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.hero}>
          <LinearGradient
            colors={theme.colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBadge}
          >
            <Ionicons name="rocket" size={40} color="#000" />
          </LinearGradient>

          <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
            Welcome to Memorize
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
            Let's set up your personalized learning experience
          </Text>
        </Animated.View>

        {/* Feature Cards */}
        <View style={styles.features}>
          <Animated.View entering={FadeInDown.delay(200)}>
            <FeatureCard
              icon="school"
              title="Science-Backed Learning"
              description="Proven spaced repetition algorithm that maximizes retention"
              color={theme.colors.primary}
              theme={theme}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(300)}>
            <FeatureCard
              icon="trending-up"
              title="Track Your Growth"
              description="Beautiful analytics show your progress and streaks"
              color={theme.colors.success}
              theme={theme}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(400)}>
            <FeatureCard
              icon="sparkles"
              title="AI-Powered Creation"
              description="Generate high-quality flashcards from any content instantly"
              color={theme.colors.warning}
              theme={theme}
            />
          </Animated.View>
        </View>

        {/* CTA */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.footer}>
          <PrimaryButton
            title="Get Started"
            onPress={handleContinue}
          />
          <Text style={[styles.footerHint, { color: theme.colors.textTertiary }]}>
            Takes less than a minute
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

interface FeatureCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  theme: any;
}

function FeatureCard({ icon, title, description, color, theme }: FeatureCardProps) {
  return (
    <View style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.featureIconWrap, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={22} color={color} />
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, { color: theme.colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.featureDesc, { color: theme.colors.textSecondary }]}>
          {description}
        </Text>
      </View>
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
    paddingTop: s.xl * 2,
    paddingBottom: s.xl,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
    gap: s.lg,
  },
  gradientBadge: {
    width: 80,
    height: 80,
    borderRadius: r.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: s.md,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: s.lg,
  },
  features: {
    gap: s.md,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: s.xl,
  },
  featureCard: {
    flexDirection: 'row',
    padding: s.lg,
    borderRadius: r.lg,
    gap: s.lg,
    alignItems: 'flex-start',
  },
  featureIconWrap: {
    width: 48,
    height: 48,
    borderRadius: r.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
    gap: s.xs,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  featureDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    gap: s.md,
  },
  footerHint: {
    fontSize: 13,
    textAlign: 'center',
  },
});
