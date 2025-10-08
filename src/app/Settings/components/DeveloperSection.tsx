import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import PrimaryButton from '../../../components/PrimaryButton';
import { ApiService, UserInfo } from '../../../services/cloud';
import { useTheme } from '../../../design/theme';
import { useAuth } from '../../../context/AuthContext';

/**
 * Developer section for testing backend connection
 * Add this to SettingsScreen to test API integration
 */
export const DeveloperSection: React.FC = () => {
  const { colors } = useTheme();
  const { getIdToken } = useAuth();
  const [testing, setTesting] = useState(false);
  const [lastTest, setLastTest] = useState<string>('');

  const testHealthCheck = async () => {
    try {
      setTesting(true);
      const apiUrl = ApiService.getBaseUrl();
      console.log('[Developer] Testing health check:', apiUrl);
      
      const isHealthy = await ApiService.checkHealth();
      
      if (isHealthy) {
        setLastTest('✅ Health check passed!');
        Alert.alert('Success', 'Backend is healthy!');
      } else {
        setLastTest('❌ Health check failed');
        Alert.alert('Error', 'Backend health check failed');
      }
    } catch (error: any) {
      console.error('[Developer] Health check error:', error);
      setLastTest(`❌ Error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setTesting(false);
    }
  };

  const testAuthenticatedEndpoint = async () => {
    try {
      setTesting(true);
      console.log('[Developer] Testing authenticated endpoint');
      
      const userInfo = await ApiService.get<UserInfo>('/user/me');
      
      setLastTest(`✅ User: ${userInfo.email}`);
      Alert.alert(
        'Success!',
        `Authenticated as: ${userInfo.email}\nUID: ${userInfo.uid}\nPremium: ${userInfo.premium}`
      );
    } catch (error: any) {
      console.error('[Developer] Auth test error:', error);
      setLastTest(`❌ Error: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setTesting(false);
    }
  };

  const showToken = async () => {
    try {
      const token = await getIdToken(true);
      if (token) {
        console.log('[Developer] Firebase Token:', token);
        Alert.alert('Token', `Token logged to console (${token.substring(0, 20)}...)`);
      } else {
        Alert.alert('Error', 'No token available');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const showApiUrl = () => {
    const url = ApiService.getBaseUrl();
    Alert.alert('API Base URL', url);
    console.log('[Developer] API URL:', url);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        🔧 Developer Tools
      </Text>
      
      <View style={styles.buttonContainer}>
        <PrimaryButton
          title={testing ? "Testing..." : "Test Health Check"}
          onPress={testHealthCheck}
        />
        
        <PrimaryButton
          title={testing ? "Testing..." : "Test Authenticated API"}
          onPress={testAuthenticatedEndpoint}
        />
        
        <PrimaryButton
          title="Show Auth Token"
          onPress={showToken}
        />
        
        <PrimaryButton
          title="Show API URL"
          onPress={showApiUrl}
        />
      </View>

      {lastTest ? (
        <View style={[styles.resultBox, { backgroundColor: colors.bg }]}>
          <Text style={[styles.resultText, { color: colors.textSecondary }]}>
            {lastTest}
          </Text>
        </View>
      ) : null}

      <Text style={[styles.info, { color: colors.textSecondary }]}>
        Use these tools to verify backend connectivity.
        Check console logs for detailed output.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 12,
    marginBottom: 16,
  },
  resultBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'Courier',
  },
  info: {
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
});
