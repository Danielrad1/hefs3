import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const NOTIFICATION_SETTINGS_KEY = '@notificationSettings';
const NOTIFICATION_ID_KEY = '@dailyNotificationId';

export interface NotificationSettings {
  enabled: boolean;
  dailyReminderEnabled: boolean;
  reminderTime: { hour: number; minute: number }; // 24-hour format
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  dailyReminderEnabled: false,
  reminderTime: { hour: 20, minute: 0 }, // 8:00 PM default
};

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Service for managing push notifications and daily reminders
 */
export class NotificationService {
  /**
   * Request notification permissions from the user
   */
  static async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Permission denied');
        return false;
      }

      // For Android, create notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8B5CF6',
        });

        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Daily Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8B5CF6',
        });
      }

      console.log('[Notifications] Permission granted');
      return true;
    } catch (error) {
      console.error('[Notifications] Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Check if notifications are enabled
   */
  static async hasPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[Notifications] Error checking permissions:', error);
      return false;
    }
  }

  /**
   * Get current notification settings
   */
  static async getSettings(): Promise<NotificationSettings> {
    try {
      const json = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (json) {
        return JSON.parse(json);
      }
      return { ...DEFAULT_SETTINGS };
    } catch (error) {
      console.error('[Notifications] Error loading settings:', error);
      return { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save notification settings
   */
  static async saveSettings(settings: NotificationSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('[Notifications] Error saving settings:', error);
      throw error;
    }
  }

  /**
   * Enable or disable notifications
   */
  static async setNotificationsEnabled(enabled: boolean): Promise<boolean> {
    try {
      // If enabling, request permissions first
      if (enabled) {
        const hasPermission = await this.requestPermissions();
        if (!hasPermission) {
          return false;
        }
      }

      const settings = await this.getSettings();
      settings.enabled = enabled;
      await this.saveSettings(settings);

      // If disabling, cancel all notifications
      if (!enabled) {
        await this.cancelAllNotifications();
      }

      return true;
    } catch (error) {
      console.error('[Notifications] Error setting notifications enabled:', error);
      return false;
    }
  }

  /**
   * Enable or disable daily reminder
   */
  static async setDailyReminderEnabled(enabled: boolean): Promise<boolean> {
    try {
      const settings = await this.getSettings();

      // If enabling, ensure notifications are enabled
      if (enabled && !settings.enabled) {
        const notifEnabled = await this.setNotificationsEnabled(true);
        if (!notifEnabled) {
          return false;
        }
      }

      settings.dailyReminderEnabled = enabled;
      await this.saveSettings(settings);

      if (enabled) {
        await this.scheduleDailyReminder(settings.reminderTime);
      } else {
        await this.cancelDailyReminder();
      }

      return true;
    } catch (error) {
      console.error('[Notifications] Error setting daily reminder:', error);
      return false;
    }
  }

  /**
   * Set the time for daily reminder
   */
  static async setReminderTime(hour: number, minute: number): Promise<void> {
    try {
      const settings = await this.getSettings();
      settings.reminderTime = { hour, minute };
      await this.saveSettings(settings);

      if (settings.dailyReminderEnabled) {
        await this.scheduleDailyReminder({ hour, minute });
      }
    } catch (error) {
      console.error('[Notifications] Error setting reminder time:', error);
      throw error;
    }
  }

  /**
   * Schedule daily reminder notification
   */
  private static async scheduleDailyReminder(time: { hour: number; minute: number }): Promise<void> {
    try {
      // Cancel existing reminder
      await this.cancelDailyReminder();

      // Schedule new daily notification
      const trigger = {
        hour: time.hour,
        minute: time.minute,
        repeats: true,
      };

      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📚 Time to Study!',
          body: 'Your flashcards are waiting. Keep your streak alive!',
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });

      // Save the notification ID
      await AsyncStorage.setItem(NOTIFICATION_ID_KEY, identifier);

      console.log('[Notifications] Daily reminder scheduled for', `${time.hour}:${String(time.minute).padStart(2, '0')}`);
    } catch (error) {
      console.error('[Notifications] Error scheduling daily reminder:', error);
      throw error;
    }
  }

  /**
   * Cancel daily reminder notification
   */
  private static async cancelDailyReminder(): Promise<void> {
    try {
      const notificationId = await AsyncStorage.getItem(NOTIFICATION_ID_KEY);
      if (notificationId) {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
        await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
        console.log('[Notifications] Daily reminder cancelled');
      }
    } catch (error) {
      console.error('[Notifications] Error cancelling daily reminder:', error);
    }
  }

  /**
   * Cancel all scheduled notifications
   */
  static async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await AsyncStorage.removeItem(NOTIFICATION_ID_KEY);
      console.log('[Notifications] All notifications cancelled');
    } catch (error) {
      console.error('[Notifications] Error cancelling all notifications:', error);
    }
  }

  /**
   * Send an immediate notification (for testing or special events)
   */
  static async sendNotification(title: string, body: string): Promise<void> {
    try {
      const hasPermission = await this.hasPermissions();
      if (!hasPermission) {
        console.log('[Notifications] No permission to send notification');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
        },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('[Notifications] Error sending notification:', error);
    }
  }

  /**
   * Get all scheduled notifications (for debugging)
   */
  static async getAllScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('[Notifications] Error getting scheduled notifications:', error);
      return [];
    }
  }
}
