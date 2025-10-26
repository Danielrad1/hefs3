import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NetworkService } from '../services/network/NetworkService';
import { s } from '../design/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Banner that appears at the top of the screen when offline
 */
export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [slideAnim] = useState(new Animated.Value(-100));
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Check initial state
    NetworkService.isOnline().then(setIsOnline);

    // Subscribe to changes
    const unsubscribe = NetworkService.subscribe(setIsOnline);

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isOnline) {
      // Slide in
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 15,
      }).start();
    } else {
      // Slide out
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isOnline, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          paddingTop: insets.top,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.content}>
        <Ionicons name="cloud-offline" size={18} color="#FFF" />
        <Text style={styles.text}>No Internet Connection</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F59E0B',
    zIndex: 9999,
    elevation: 999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.sm,
    paddingVertical: s.sm,
    paddingHorizontal: s.md,
  },
  text: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
