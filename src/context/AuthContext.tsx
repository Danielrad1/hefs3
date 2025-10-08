import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../config/firebase';
import { AuthContextType, User, mapFirebaseUser } from '../types/auth';

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

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged((firebaseUser: any) => {
      setUser(mapFirebaseUser(firebaseUser));
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await auth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('[Auth] Email sign-in error:', error);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    try {
      await auth().createUserWithEmailAndPassword(email, password);
    } catch (error) {
      console.error('[Auth] Email sign-up error:', error);
      throw error;
    }
  };

  const signInAnonymously = async () => {
    try {
      await auth().signInAnonymously();
    } catch (error) {
      console.error('[Auth] Anonymous sign-in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await auth().signOut();
    } catch (error) {
      console.error('[Auth] Sign-out error:', error);
      throw error;
    }
  };

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    try {
      const token = await auth().currentUser?.getIdToken(forceRefresh);
      return token || null;
    } catch (error) {
      console.error('[Auth] Get token error:', error);
      return null;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInAnonymously,
    signOut,
    getIdToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
