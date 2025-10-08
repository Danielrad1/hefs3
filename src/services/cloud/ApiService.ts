import Constants from 'expo-constants';
import { auth } from '../../config/firebase';

const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl as string;

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * Base API service for making authenticated requests to the backend
 */
export class ApiService {
  /**
   * Get authentication headers with Firebase ID token
   */
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const token = await auth().currentUser?.getIdToken(true);
    if (!token) {
      throw new Error('Not authenticated');
    }
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make an authenticated API request
   */
  static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${API_BASE}${endpoint}`;

      console.log(`[ApiService] ${options.method || 'GET'} ${endpoint}`);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      const data: ApiResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        console.error(`[ApiService] Request failed:`, data.error);
        throw new Error(data.error?.message || 'API request failed');
      }

      console.log(`[ApiService] Success:`, endpoint);
      return data;
    } catch (error) {
      console.error(`[ApiService] ${endpoint} failed:`, error);
      throw error;
    }
  }

  /**
   * GET request
   */
  static async get<T>(endpoint: string): Promise<T> {
    const response = await this.request<T>(endpoint, { method: 'GET' });
    return response.data!;
  }

  /**
   * POST request
   */
  static async post<T>(endpoint: string, body?: any): Promise<T> {
    const response = await this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
    return response.data!;
  }

  /**
   * Check if API is available
   */
  static async checkHealth(): Promise<boolean> {
    try {
      // Health endpoint doesn't require auth
      const url = `${API_BASE}/health`;
      const response = await fetch(url);
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('[ApiService] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get API base URL (for debugging)
   */
  static getBaseUrl(): string {
    return API_BASE;
  }
}
