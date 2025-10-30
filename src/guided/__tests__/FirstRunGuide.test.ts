/**
 * Test suite for FirstRunGuide
 * Tests guide flow gating, state management, and uid validation
 */

import { FirstRunGuide } from '../FirstRunGuide';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('FirstRunGuide', () => {
  const testUid = 'test-user-123';

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('shouldShowWelcome', () => {
    it('returns true when welcome has not been shown', async () => {
      const result = await FirstRunGuide.shouldShowWelcome(testUid);
      expect(result).toBe(true);
    });

    it('returns false after welcome is marked as shown', async () => {
      await FirstRunGuide.markWelcomeShown(testUid);
      const result = await FirstRunGuide.shouldShowWelcome(testUid);
      expect(result).toBe(false);
    });

    it('returns false when uid is null', async () => {
      const result = await FirstRunGuide.shouldShowWelcome(null);
      expect(result).toBe(false);
    });

    it('returns false when uid is undefined', async () => {
      const result = await FirstRunGuide.shouldShowWelcome(undefined);
      expect(result).toBe(false);
    });

    it('returns false when uid is empty string', async () => {
      const result = await FirstRunGuide.shouldShowWelcome('');
      expect(result).toBe(false);
    });
  });

  describe('markWelcomeShown', () => {
    it('persists welcome shown state', async () => {
      await FirstRunGuide.markWelcomeShown(testUid);
      
      const value = await AsyncStorage.getItem(`@firstRun:${testUid}:welcome:shown`);
      expect(value).toBe('true');
    });

    it('is a no-op when uid is missing', async () => {
      await FirstRunGuide.markWelcomeShown(null);
      await FirstRunGuide.markWelcomeShown(undefined);
      await FirstRunGuide.markWelcomeShown('');
      
      // Should not throw, and storage should be empty
      const keys = await AsyncStorage.getAllKeys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('shouldShowDiscover', () => {
    it('returns true when discover has not been shown or completed', async () => {
      const result = await FirstRunGuide.shouldShowDiscover(testUid);
      expect(result).toBe(true);
    });

    it('returns false after discover is marked as shown', async () => {
      await FirstRunGuide.markDiscoverShown(testUid);
      const result = await FirstRunGuide.shouldShowDiscover(testUid);
      expect(result).toBe(false);
    });

    it('returns false after discover is completed', async () => {
      await FirstRunGuide.completeDiscover(testUid);
      const result = await FirstRunGuide.shouldShowDiscover(testUid);
      expect(result).toBe(false);
    });

    it('returns false when uid is invalid', async () => {
      const result = await FirstRunGuide.shouldShowDiscover(null);
      expect(result).toBe(false);
    });
  });

  describe('completeDiscover', () => {
    it('marks discover as done', async () => {
      await FirstRunGuide.completeDiscover(testUid);
      
      const value = await AsyncStorage.getItem(`@firstRun:${testUid}:discover:done`);
      expect(value).toBe('true');
    });

    it('schedules study guide', async () => {
      await FirstRunGuide.completeDiscover(testUid);
      
      const value = await AsyncStorage.getItem(`@firstRun:${testUid}:study:scheduled`);
      expect(value).toBe('true');
    });

    it('resets study shown flag', async () => {
      await FirstRunGuide.completeDiscover(testUid);
      
      const value = await AsyncStorage.getItem(`@firstRun:${testUid}:study:shown`);
      expect(value).toBe('false');
    });

    it('is a no-op when uid is invalid', async () => {
      await FirstRunGuide.completeDiscover(null);
      
      const keys = await AsyncStorage.getAllKeys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('shouldShowStudy', () => {
    it('returns false when study is not scheduled', async () => {
      const result = await FirstRunGuide.shouldShowStudy(testUid);
      expect(result).toBe(false);
    });

    it('returns true when study is scheduled and not shown', async () => {
      await FirstRunGuide.completeDiscover(testUid);
      const result = await FirstRunGuide.shouldShowStudy(testUid);
      expect(result).toBe(true);
    });

    it('returns false after study is marked as shown', async () => {
      await FirstRunGuide.completeDiscover(testUid);
      await FirstRunGuide.markStudyShown(testUid);
      
      const result = await FirstRunGuide.shouldShowStudy(testUid);
      expect(result).toBe(false);
    });

    it('returns false after study is completed', async () => {
      await FirstRunGuide.completeDiscover(testUid);
      await FirstRunGuide.completeStudy(testUid);
      
      const result = await FirstRunGuide.shouldShowStudy(testUid);
      expect(result).toBe(false);
    });

    it('returns false when uid is invalid', async () => {
      const result = await FirstRunGuide.shouldShowStudy(null);
      expect(result).toBe(false);
    });
  });

  describe('completeStudy', () => {
    it('marks study as done', async () => {
      await FirstRunGuide.completeStudy(testUid);
      
      const value = await AsyncStorage.getItem(`@firstRun:${testUid}:study:done`);
      expect(value).toBe('true');
    });

    it('is a no-op when uid is invalid', async () => {
      await FirstRunGuide.completeStudy(null);
      
      const keys = await AsyncStorage.getAllKeys();
      expect(keys).toHaveLength(0);
    });
  });

  describe('complete flow', () => {
    it('follows expected sequence: welcome -> discover -> study', async () => {
      // Initial state: should show welcome
      expect(await FirstRunGuide.shouldShowWelcome(testUid)).toBe(true);
      expect(await FirstRunGuide.shouldShowDiscover(testUid)).toBe(true);
      expect(await FirstRunGuide.shouldShowStudy(testUid)).toBe(false);

      // Mark welcome shown
      await FirstRunGuide.markWelcomeShown(testUid);
      expect(await FirstRunGuide.shouldShowWelcome(testUid)).toBe(false);
      expect(await FirstRunGuide.shouldShowDiscover(testUid)).toBe(true);

      // Mark discover shown
      await FirstRunGuide.markDiscoverShown(testUid);
      expect(await FirstRunGuide.shouldShowDiscover(testUid)).toBe(false);
      expect(await FirstRunGuide.shouldShowStudy(testUid)).toBe(false);

      // Complete discover (schedules study)
      await FirstRunGuide.completeDiscover(testUid);
      expect(await FirstRunGuide.shouldShowDiscover(testUid)).toBe(false);
      expect(await FirstRunGuide.shouldShowStudy(testUid)).toBe(true);

      // Mark study shown
      await FirstRunGuide.markStudyShown(testUid);
      expect(await FirstRunGuide.shouldShowStudy(testUid)).toBe(false);

      // Complete study
      await FirstRunGuide.completeStudy(testUid);
      expect(await FirstRunGuide.shouldShowStudy(testUid)).toBe(false);
    });
  });

  describe('resetAll', () => {
    it('clears all guide flags', async () => {
      // Set all flags
      await FirstRunGuide.markWelcomeShown(testUid);
      await FirstRunGuide.markDiscoverShown(testUid);
      await FirstRunGuide.completeDiscover(testUid);
      await FirstRunGuide.completeStudy(testUid);

      // Verify they're set
      expect(await FirstRunGuide.shouldShowWelcome(testUid)).toBe(false);
      
      // Reset
      await FirstRunGuide.resetAll(testUid);

      // Verify back to initial state
      expect(await FirstRunGuide.shouldShowWelcome(testUid)).toBe(true);
      expect(await FirstRunGuide.shouldShowDiscover(testUid)).toBe(true);
      expect(await FirstRunGuide.shouldShowStudy(testUid)).toBe(false);
    });

    it('is a no-op when uid is invalid', async () => {
      await FirstRunGuide.markWelcomeShown(testUid);
      
      // Try to reset with invalid uid
      await FirstRunGuide.resetAll(null);
      
      // Original user's data should still be there
      expect(await FirstRunGuide.shouldShowWelcome(testUid)).toBe(false);
    });
  });

  describe('multi-user isolation', () => {
    it('maintains separate state for different users', async () => {
      const user1 = 'user-1';
      const user2 = 'user-2';

      // Mark welcome shown for user1
      await FirstRunGuide.markWelcomeShown(user1);

      // user1 should not show welcome, user2 should
      expect(await FirstRunGuide.shouldShowWelcome(user1)).toBe(false);
      expect(await FirstRunGuide.shouldShowWelcome(user2)).toBe(true);

      // Complete discover for user2
      await FirstRunGuide.completeDiscover(user2);

      // Only user2 should show study
      expect(await FirstRunGuide.shouldShowStudy(user1)).toBe(false);
      expect(await FirstRunGuide.shouldShowStudy(user2)).toBe(true);
    });
  });
});
