import Constants from 'expo-constants';
import { auth } from '../../config/firebase';
import { logger } from '../../utils/logger';

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
    // Let Firebase handle token refresh automatically (don't force with true)
    const token = await auth().currentUser?.getIdToken();
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
    options: RequestInit = {},
    timeoutMs: number = 120000 // 2 minutes default
  ): Promise<ApiResponse<T>> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${API_BASE}${endpoint}`;

      logger.info(`[ApiService] ${options.method || 'GET'} ${endpoint}`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        logger.error(`[ApiService] Non-JSON response:`, text.substring(0, 500));
        throw new Error(`Server returned non-JSON response. Status: ${response.status}`);
      }

      const data: ApiResponse<T> = await response.json();

      if (!response.ok || !data.success) {
        logger.error(`[ApiService] Request failed:`, data.error);
        throw new Error(data.error?.message || 'API request failed');
      }

      logger.info(`[ApiService] Success:`, endpoint);
      return data;
    } catch (error) {
      // Provide better error message for timeouts
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`[ApiService] ${endpoint} timed out after ${timeoutMs}ms`);
        throw new Error(`Request timed out. The file may be too large or the server is busy. Please try again.`);
      }
      logger.error(`[ApiService] ${endpoint} failed:`, error);
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
  static async post<T>(endpoint: string, body?: any, timeoutMs?: number): Promise<T> {
    // Use longer timeout for file parsing and AI generation
    const defaultTimeout = endpoint.includes('/parse/') || endpoint.includes('/ai/') 
      ? 300000 // 5 minutes for file parsing and AI
      : 120000; // 2 minutes for other requests
    
    const response = await this.request<T>(
      endpoint, 
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      timeoutMs || defaultTimeout
    );
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
      logger.error('[ApiService] Health check failed:', error);
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
