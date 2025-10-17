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
    const unsubscribe = auth().onAuthStateChanged((firebaseUser: any) => {
      setUser(mapFirebaseUser(firebaseUser));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Handle Google OAuth response
  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      handleGoogleToken(id_token);
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
      logger.error('[Auth] Apple sign-in error:', error);
      
      if (isUserCancellation(error)) {
        // User cancelled - don't throw error
        return;
      }
      
      const friendlyMessage = mapAuthError(error);
      const enhancedError = new Error(friendlyMessage);
      (enhancedError as any).code = (error as any)?.code;
      throw enhancedError;
    }
  };

  const handleGoogleToken = async (idToken: string) => {
    try {
      const credential = auth.GoogleAuthProvider.credential(idToken);
      await auth().signInWithCredential(credential);
    } catch (error) {
      logger.error('[Auth] Google token exchange error:', error);
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
