import Constants from 'expo-constants';
import { auth } from '../../config/firebase';
import { logger } from '../../utils/logger';
import { NetworkService } from '../network/NetworkService';

const API_BASE = Constants.expoConfig?.extra?.apiBaseUrl as string;
const IS_LOCAL = Constants.expoConfig?.extra?.isLocal === true;

// Log environment on startup
const ENV = Constants.expoConfig?.extra?.environment || 'unknown';
logger.info('[ApiService] Initialized', {
  environment: ENV,
  mode: IS_LOCAL ? 'LOCAL_EMULATOR' : 'PRODUCTION_CLOUD',
  apiBase: API_BASE,
});

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
      // Check network connectivity first
      const isOnline = await NetworkService.isOnline();
      if (!isOnline) {
        throw new Error('NETWORK_OFFLINE');
      }

      const headers = await this.getAuthHeaders();
      const url = `${API_BASE}${endpoint}`;

      logger.info(`[ApiService] ${options.method || 'GET'} ${url}`);

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

      // Handle common non-JSON error responses with user-friendly messages
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        const isJson = contentType?.includes('application/json');
        
        // Handle 413 Payload Too Large specifically
        if (response.status === 413) {
          throw new Error('File too large. Please try a smaller file or split your content into multiple files.');
        }
        
        // Handle other common errors with specific messages
        if (!isJson) {
          // Non-JSON error responses (CORS, proxy errors, etc.)
          const statusMessages: Record<number, string> = {
            401: 'Authentication failed. Please sign in again.',
            403: 'Access denied. You do not have permission to access this resource.',
            429: 'Too many requests. Please wait a moment and try again.',
            500: 'Server error. Please try again later.',
            502: 'Server temporarily unavailable. Please try again later.',
            503: 'Service temporarily unavailable. Please try again later.',
            504: 'Request timed out. Please try again.',
          };
          
          const message = statusMessages[response.status] || `Request failed with status ${response.status}`;
          logger.error(`[ApiService] Non-JSON error response:`, { status: response.status, endpoint });
          throw new Error(message);
        }
      }

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
      // Handle network offline error
      if (error instanceof Error && error.message === 'NETWORK_OFFLINE') {
        logger.warn(`[ApiService] ${endpoint} failed: No internet connection`);
        throw new Error('No internet connection. Please check your network and try again.');
      }

      // Handle timeout errors
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error(`[ApiService] ${endpoint} timed out after ${timeoutMs}ms`);
        throw new Error(`Request timed out. The file may be too large or the server is busy. Please try again.`);
      }

      // Handle network errors (fetch failures)
      if (error instanceof Error && (
        error.message.includes('Network request failed') ||
        error.message.includes('Failed to fetch')
      )) {
        logger.error(`[ApiService] ${endpoint} network error:`, error.message);
        throw new Error('Unable to connect to the server. Please check your internet connection.');
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
      ? 600000 // 10 minutes for file parsing and AI (hints can take a while for large decks)
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
      
      // Add 5 second timeout to prevent blocking
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('[ApiService] Health check timed out after 5s');
        return false;
      }
      
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
