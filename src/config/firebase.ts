/**
 * Firebase Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create Firebase project at https://console.firebase.google.com
 * 2. Add iOS app to project
 * 3. Download GoogleService-Info.plist
 * 4. Place in /ios/memorizeapp/ directory
 * 5. Add to Xcode project
 * 6. Enable Authentication (Email/Password, Apple) in Firebase Console
 * 7. Run: npx expo run:ios (required for native modules)
 * 
 * NOTE: Firestore has been removed due to build compatibility issues.
 * All data is stored locally in SQLite. Cloud sync can be added later
 * with a different solution (Supabase, custom backend, etc.)
 */

// Import Firebase modules
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import { logger } from '../utils/logger';

// Check if Firebase app is initialized (auto-initializes from GoogleService-Info.plist)
try {
  // Access the default app to ensure it's initialized
  if (firebase.apps && firebase.apps.length > 0) {
    logger.info('[Firebase] App already initialized:', firebase.app().name);
  } else {
    logger.info('[Firebase] Waiting for auto-initialization from GoogleService-Info.plist');
  }
} catch (error) {
  logger.error('[Firebase] Initialization check failed:', error);
}

// Export Firebase services
export { auth };
