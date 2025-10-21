/**
 * Firebase Configuration
 * 
 * SETUP INSTRUCTIONS:
 * 1. Create Firebase project at https://console.firebase.google.com
 * 2. Add iOS app with bundle ID: com.enqode.app
 * 3. Download GoogleService-Info.plist
 * 4. Place in /ios/enqode/ directory
 * 5. Enable Authentication (Email/Password, Apple) in Firebase Console
 * 6. Run: npx expo run:ios --device (required for native modules)
 * 
 * PRICING: Start with FREE Spark Plan (10K auth/month)
 * Upgrade to Blaze (pay-as-you-go) only when needed
 * 
 * NOTE: Firestore has been removed due to build compatibility issues.
 * All data is stored locally in SQLite. Cloud sync can be added later
 * with a different solution (Supabase, custom backend, etc.)
 */

// Import Firebase modules
import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import { logger } from '../utils/logger';

// Manual initialization for Expo dev client
// React Native Firebase doesn't auto-initialize in dev builds
const firebaseConfig = {
  clientId: '953455180571-8jc7qunauq08q73uiehk7uou8d55a8mf.apps.googleusercontent.com',
  appId: '1:953455180571:ios:59f069854ed96b7f4bf1be',
  apiKey: 'AIzaSyAw4Xv6tG63TMwcziZqdUUdk6CMfwjRapw',
  databaseURL: '',
  storageBucket: 'enqode-6b13f.firebasestorage.app',
  messagingSenderId: '953455180571',
  projectId: 'enqode-6b13f',
};

// Initialize if not already initialized
if (firebase.apps.length === 0) {
  try {
    firebase.initializeApp(firebaseConfig);
    logger.info('[Firebase] ✅ Manually initialized successfully');
  } catch (error) {
    logger.error('[Firebase] ❌ Manual initialization failed:', error);
  }
}

// Verify initialization
setTimeout(() => {
  try {
    if (firebase.apps.length > 0) {
      const app = firebase.app();
      logger.info('[Firebase] ✅ App is initialized');
      logger.info('[Firebase] Project:', app.options.projectId);
    } else {
      logger.error('[Firebase] ❌ No app initialized');
    }
  } catch (error) {
    logger.error('[Firebase] Status check failed:', error);
  }
}, 500);

// Export Firebase services
export { auth };
