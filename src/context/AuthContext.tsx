import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { auth } from '../config/firebase';
import { AuthContextType, User, mapFirebaseUser } from '../types/auth';
import { mapAuthError, isUserCancellation } from '../utils/authErrors';
import { UserPrefsService } from '../services/onboarding/UserPrefsService';
import { logger } from '../utils/logger';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Google OAuth configuration
  const [_googleRequest, googleResponse, googlePromptAsync] = Google.useIdTokenAuthRequest({
    iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
    webClientId: Constants.expoConfig?.extra?.googleWebClientId,
  });

  // Listen for auth state changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    // Small delay to ensure Firebase native module initializes
    const timeout = setTimeout(() => {
      try {
        unsubscribe = auth().onAuthStateChanged((firebaseUser: any) => {
          setUser(mapFirebaseUser(firebaseUser));
          setLoading(false);
        });
      } catch (error) {
        logger.error('[Auth] Failed to set up auth listener:', error);
        setLoading(false);
      }
    }, 100);

    return () => {
      clearTimeout(timeout);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      logger.info('[Auth] Google OAuth success, exchanging token...');
      logger.info('[Auth] Google response:', JSON.stringify(googleResponse, null, 2));
      const { id_token } = googleResponse.params;
      handleGoogleToken(id_token);
    } else if (googleResponse?.type === 'error') {
      logger.error('[Auth] Google OAuth error:', googleResponse.error);
    } else if (googleResponse?.type === 'cancel') {
      logger.info('[Auth] Google OAuth cancelled by user');
    }
  }, [googleResponse]);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      logger.error('[Auth] Email sign-in error:', error);
      const friendlyMessage = mapAuthError(error);
      const enhancedError = new Error(friendlyMessage);
      (enhancedError as any).code = (error as any)?.code;
      throw enhancedError;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await auth().createUserWithEmailAndPassword(email, password);
    } catch (error) {
      logger.error('[Auth] Sign up error:', error);
      const friendlyMessage = mapAuthError(error);
      const enhancedError = new Error(friendlyMessage);
      (enhancedError as any).code = (error as any)?.code;
      throw enhancedError;
    }
  };

  const signInWithApple = async () => {
    try {
      if (Platform.OS !== 'ios') {
        throw new Error('Apple Sign-In is only available on iOS');
      }

      // Check if Apple Sign-In is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple Sign-In is not available on this device');
      }

      // Request Apple credentials
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Create Firebase credential
      const { identityToken } = credential;
      if (!identityToken) {
        throw new Error('No identity token returned from Apple');
      }

      const provider = auth.AppleAuthProvider;
      const firebaseCredential = provider.credential(identityToken);

      // Sign in with Firebase
      const userCredential = await auth().signInWithCredential(firebaseCredential);

      // Capture full name if provided (only on first sign-in)
      if (credential.fullName?.givenName || credential.fullName?.familyName) {
        const displayName = [
          credential.fullName.givenName,
          credential.fullName.familyName,
        ]
          .filter(Boolean)
          .join(' ');

        if (displayName && userCredential.user) {
          await userCredential.user.updateProfile({ displayName });
        }
      }
    } catch (error) {
      // Log full error details for debugging
      logger.error('[Auth] Apple sign-in error:', error);
      logger.error('[Auth] Error type:', error instanceof Error ? error.constructor.name : typeof error);
      logger.error('[Auth] Error message:', error instanceof Error ? error.message : String(error));
      logger.error('[Auth] Error code:', (error as any)?.code);
      logger.error('[Auth] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      if (isUserCancellation(error)) {
        // User cancelled - don't throw error
        logger.info('[Auth] User cancelled Apple sign-in');
        return;
      }
      
      const friendlyMessage = mapAuthError(error);
      const enhancedError = new Error(friendlyMessage);
      (enhancedError as any).code = (error as any)?.code;
      (enhancedError as any).originalError = error;
      throw enhancedError;
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    try {
      logger.info('[Auth] Creating Firebase credential from Google token...');
      const credential = auth.GoogleAuthProvider.credential(idToken);
      logger.info('[Auth] Signing in with Firebase credential...');
      const result = await auth().signInWithCredential(credential);
      logger.info('[Auth] ✅ Firebase sign-in successful!');
      logger.info('[Auth] User:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });
    } catch (error) {
      logger.error('[Auth] ❌ Google token exchange error:', error);
      logger.error('[Auth] Error details:', JSON.stringify(error, null, 2));
      const friendlyMessage = mapAuthError(error);
      const enhancedError = new Error(friendlyMessage);
      (enhancedError as any).code = (error as any)?.code;
      throw enhancedError;
    }
  };

  const signInWithGoogle = async () => {
    try {
      await googlePromptAsync();
      // The actual sign-in happens in the useEffect when googleResponse updates
    } catch (error) {
      logger.error('[Auth] Google sign-in error:', error);
      
      if (isUserCancellation(error)) {
        return;
      }
      
      const friendlyMessage = mapAuthError(error);
      const enhancedError = new Error(friendlyMessage);
      (enhancedError as any).code = (error as any)?.code;
      throw enhancedError;
    }
  };

  const signOut = async () => {
    try {
      const uid = user?.uid;
      await auth().signOut();
      
      // Clear user preferences to avoid cross-account flag bleed on shared devices
      if (uid) {
        await UserPrefsService.clearUserData(uid);
      }
    } catch (error) {
      logger.error('[Auth] Sign-out error:', error);
      throw error;
    }
  };

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    try {
      const token = await auth().currentUser?.getIdToken(forceRefresh);
      return token || null;
    } catch (error) {
      logger.error('[Auth] Get token error:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithApple,
    signInWithGoogle,
    signOut,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
