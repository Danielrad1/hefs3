import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../../config/firebase';
import { logger } from '../../utils/logger';

/**
 * User profile information collected during onboarding
 */
export interface UserProfile {
  displayName: string;
  firstName?: string;
  lastName?: string;
}

/**
 * User preferences collected during onboarding
 */
export interface UserPreferences {
  dailyReminder: boolean;
  reminderTime?: string; // HH:mm format
  schedule: 'morning' | 'evening' | 'anytime';
  goalMinutes: number;
  themePreference: 'system' | 'light' | 'dark';
}

/**
 * Default preferences for new users
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  dailyReminder: false,
  schedule: 'anytime',
  goalMinutes: 15,
  themePreference: 'system',
};

/**
 * Service for managing user onboarding state and preferences
 */
export class UserPrefsService {
  // AsyncStorage keys
  private static getOnboardingKey(uid: string): string {
    return `@onboardingCompleted:${uid}`;
  }

  private static getTutorialKey(uid: string): string {
    return `@tutorialCompleted:${uid}`;
  }

  private static getProfileKey(uid: string): string {
    return `@userProfile:${uid}`;
  }

  private static getPrefsKey(uid: string): string {
    return `@userPrefs:${uid}`;
  }

  // Onboarding completion
  static async getOnboardingCompleted(uid: string): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(this.getOnboardingKey(uid));
      return value === 'true';
    } catch (error) {
      logger.error('[UserPrefs] Error getting onboarding status:', error);
      return false;
    }
  }

  static async setOnboardingCompleted(uid: string, completed: boolean = true): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getOnboardingKey(uid), completed ? 'true' : 'false');
    } catch (error) {
      logger.error('[UserPrefs] Error setting onboarding status:', error);
      throw error;
    }
  }

  // Tutorial completion
  static async getTutorialCompleted(uid: string): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(this.getTutorialKey(uid));
      return value === 'true';
    } catch (error) {
      logger.error('[UserPrefs] Error getting tutorial status:', error);
      return false;
    }
  }

  static async setTutorialCompleted(uid: string, completed: boolean = true): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getTutorialKey(uid), completed ? 'true' : 'false');
    } catch (error) {
      logger.error('[UserPrefs] Error setting tutorial status:', error);
      throw error;
    }
  }

  // Check if user is new (account created in last 5 minutes)
  static async isNewUser(uid: string): Promise<boolean> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser || currentUser.uid !== uid) {
        return false;
      }

      // Check Firebase Auth metadata
      const creationTime = currentUser.metadata.creationTime;
      const lastSignInTime = currentUser.metadata.lastSignInTime;

      if (!creationTime) {
        return false;
      }

      // If account created in last 5 minutes, it's a new user
      const createdAt = new Date(creationTime).getTime();
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);

      return createdAt > fiveMinutesAgo;
    } catch (error) {
      logger.error('[UserPrefs] Error checking if new user:', error);
      return false; // Default to not new (skip onboarding on error)
    }
  }

  // User profile
  static async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const value = await AsyncStorage.getItem(this.getProfileKey(uid));
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('[UserPrefs] Error getting user profile:', error);
      return null;
    }
  }

  static async setUserProfile(uid: string, profile: UserProfile): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getProfileKey(uid), JSON.stringify(profile));
    } catch (error) {
      logger.error('[UserPrefs] Error setting user profile:', error);
      throw error;
    }
  }

  // User preferences
  static async getUserPreferences(uid: string): Promise<UserPreferences> {
    try {
      const value = await AsyncStorage.getItem(this.getPrefsKey(uid));
      return value ? JSON.parse(value) : { ...DEFAULT_PREFERENCES };
    } catch (error) {
      logger.error('[UserPrefs] Error getting user preferences:', error);
      return { ...DEFAULT_PREFERENCES };
    }
  }

  static async setUserPreferences(uid: string, prefs: Partial<UserPreferences>): Promise<void> {
    try {
      // Merge with existing preferences
      const existing = await this.getUserPreferences(uid);
      const updated = { ...existing, ...prefs };
      await AsyncStorage.setItem(this.getPrefsKey(uid), JSON.stringify(updated));
    } catch (error) {
      logger.error('[UserPrefs] Error setting user preferences:', error);
      throw error;
    }
  }

  // Clear all user data (for sign-out)
  static async clearUserData(uid: string): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.getOnboardingKey(uid),
        this.getTutorialKey(uid),
        this.getProfileKey(uid),
        this.getPrefsKey(uid),
      ]);
    } catch (error) {
      logger.error('[UserPrefs] Error clearing user data:', error);
      throw error;
    }
  }
}
