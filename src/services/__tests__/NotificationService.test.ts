/**
 * Test suite for Notification Service
 * Tests permission handling, daily reminder scheduling, and notification management
 */

import { NotificationService } from '../NotificationService';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: {
    CALENDAR: 'calendar',
  },
  AndroidImportance: {
    MAX: 5,
    HIGH: 4,
  },
  AndroidNotificationPriority: {
    HIGH: 1,
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock Platform
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj) => obj.ios),
}));

describe('NotificationService', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('requestPermissions', () => {
    it('returns true when permission is already granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await NotificationService.requestPermissions();

      expect(result).toBe(true);
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('requests permission when not granted and returns true on grant', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await NotificationService.requestPermissions();

      expect(result).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it('returns false when permission is denied', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await NotificationService.requestPermissions();

      expect(result).toBe(false);
    });

    it('sets up Android notification channels on Android', async () => {
      // Change platform to Android
      const Platform = require('react-native/Libraries/Utilities/Platform');
      Platform.OS = 'android';

      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      await NotificationService.requestPermissions();

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
        })
      );
      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'reminders',
        expect.objectContaining({
          name: 'Daily Reminders',
          importance: Notifications.AndroidImportance.HIGH,
        })
      );

      // Reset platform
      Platform.OS = 'ios';
    });
  });

  describe('setNotificationsEnabled', () => {
    it('enables notifications and requests permissions', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await NotificationService.setNotificationsEnabled(true);

      expect(result).toBe(true);
      
      const settings = await NotificationService.getSettings();
      expect(settings.enabled).toBe(true);
    });

    it('returns false when permission is denied', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await NotificationService.setNotificationsEnabled(true);

      expect(result).toBe(false);
    });

    it('disables daily reminder when disabling notifications', async () => {
      // First enable everything
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      
      await NotificationService.setNotificationsEnabled(true);
      await NotificationService.setDailyReminderEnabled(true);

      // Now disable notifications
      await NotificationService.setNotificationsEnabled(false);

      const settings = await NotificationService.getSettings();
      expect(settings.enabled).toBe(false);
      expect(settings.dailyReminderEnabled).toBe(false);
      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });
  });

  describe('setDailyReminderEnabled', () => {
    beforeEach(async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notification-id-123');
    });

    it('enables daily reminder and schedules notification', async () => {
      await NotificationService.setNotificationsEnabled(true);
      
      const result = await NotificationService.setDailyReminderEnabled(true);

      expect(result).toBe(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            type: 'calendar',
            repeats: true,
            hour: 20, // Default time
            minute: 0,
          }),
        })
      );

      const settings = await NotificationService.getSettings();
      expect(settings.dailyReminderEnabled).toBe(true);
    });

    it('auto-enables notifications when enabling daily reminder', async () => {
      const result = await NotificationService.setDailyReminderEnabled(true);

      expect(result).toBe(true);
      
      const settings = await NotificationService.getSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.dailyReminderEnabled).toBe(true);
    });

    it('disables daily reminder and cancels scheduled notification', async () => {
      // First enable
      await NotificationService.setDailyReminderEnabled(true);
      await AsyncStorage.setItem('@dailyNotificationId', 'notification-id-123');

      // Then disable
      await NotificationService.setDailyReminderEnabled(false);

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notification-id-123');
      
      const settings = await NotificationService.getSettings();
      expect(settings.dailyReminderEnabled).toBe(false);
    });

    it('stores notification identifier in AsyncStorage', async () => {
      await NotificationService.setDailyReminderEnabled(true);

      const storedId = await AsyncStorage.getItem('@dailyNotificationId');
      expect(storedId).toBe('notification-id-123');
    });
  });

  describe('setReminderTime', () => {
    beforeEach(async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notification-id-123');
    });

    it('updates reminder time in settings', async () => {
      await NotificationService.setReminderTime(9, 30);

      const settings = await NotificationService.getSettings();
      expect(settings.reminderTime).toEqual({ hour: 9, minute: 30 });
    });

    it('reschedules notification when daily reminder is enabled', async () => {
      await NotificationService.setDailyReminderEnabled(true);
      
      // Clear previous calls
      jest.clearAllMocks();
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('new-notification-id');

      await NotificationService.setReminderTime(9, 30);

      // Should cancel old and schedule new
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            hour: 9,
            minute: 30,
          }),
        })
      );
    });

    it('does not schedule if daily reminder is disabled', async () => {
      await NotificationService.setReminderTime(9, 30);

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('notification scheduling', () => {
    beforeEach(async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notification-id-123');
    });

    it('uses CALENDAR trigger type with repeats true', async () => {
      await NotificationService.setDailyReminderEnabled(true);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            type: 'calendar',
            repeats: true,
          }),
        })
      );
    });

    it('includes configured hour and minute in trigger', async () => {
      await NotificationService.setReminderTime(14, 45);
      await NotificationService.setDailyReminderEnabled(true);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({
            hour: 14,
            minute: 45,
          }),
        })
      );
    });

    it('includes notification content with title and body', async () => {
      await NotificationService.setDailyReminderEnabled(true);

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '📚 Time to Study!',
            body: 'Your flashcards are waiting. Keep your streak alive!',
            sound: true,
          }),
        })
      );
    });
  });

  describe('cancelAllNotifications', () => {
    it('cancels all scheduled notifications', async () => {
      await NotificationService.cancelAllNotifications();

      expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    });

    it('removes notification ID from storage', async () => {
      await AsyncStorage.setItem('@dailyNotificationId', 'notification-id-123');
      
      await NotificationService.cancelAllNotifications();

      const storedId = await AsyncStorage.getItem('@dailyNotificationId');
      expect(storedId).toBeNull();
    });
  });

  describe('sendNotification', () => {
    it('sends immediate notification when permissions granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      await NotificationService.sendNotification('Test Title', 'Test Body');

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Test Title',
            body: 'Test Body',
          }),
          trigger: null, // Immediate
        })
      );
    });

    it('does not send when permissions denied', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      await NotificationService.sendNotification('Test Title', 'Test Body');

      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('settings persistence', () => {
    it('loads default settings when none exist', async () => {
      const settings = await NotificationService.getSettings();

      expect(settings).toEqual({
        enabled: false,
        dailyReminderEnabled: false,
        reminderTime: { hour: 20, minute: 0 },
      });
    });

    it('persists and loads custom settings', async () => {
      await NotificationService.setReminderTime(15, 30);
      
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });
      await NotificationService.setNotificationsEnabled(true);

      const settings = await NotificationService.getSettings();

      expect(settings.enabled).toBe(true);
      expect(settings.reminderTime).toEqual({ hour: 15, minute: 30 });
    });

    it('handles corrupted settings gracefully', async () => {
      await AsyncStorage.setItem('@notificationSettings', 'invalid-json{');

      const settings = await NotificationService.getSettings();

      // Should return defaults
      expect(settings.enabled).toBe(false);
      expect(settings.dailyReminderEnabled).toBe(false);
    });
  });
});
