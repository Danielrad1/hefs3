/**
 * Test suite for Cloud API Service
 * Tests offline guards, timeout handling, error mapping, and JSON response handling
 */

import { ApiService } from '../ApiService';
import { NetworkService } from '../../network/NetworkService';
import { auth } from '../../../config/firebase';

// Mock dependencies
jest.mock('../../network/NetworkService');
jest.mock('../../../config/firebase', () => ({
  auth: jest.fn(() => ({
    currentUser: {
      getIdToken: jest.fn(),
    },
  })),
}));

jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {
      apiBaseUrl: 'https://test-api.example.com',
      environment: 'test',
      isLocal: false,
    },
  },
}));

// Mock logger to prevent console spam
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('ApiService', () => {
  const mockAuthUser = {
    getIdToken: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    
    // Setup default auth mock
    (auth as jest.Mock).mockReturnValue({
      currentUser: mockAuthUser,
    });
    
    mockAuthUser.getIdToken.mockResolvedValue('mock-token-123');
    
    // Default to online
    (NetworkService.isOnline as jest.Mock).mockResolvedValue(true);
  });

  describe('offline guard', () => {
    it('rejects with no internet message when offline', async () => {
      (NetworkService.isOnline as jest.Mock).mockResolvedValue(false);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'No internet connection. Please check your network and try again.'
      );
    });

    it('does not call fetch when offline', async () => {
      (NetworkService.isOnline as jest.Mock).mockResolvedValue(false);
      const fetchSpy = jest.spyOn(global, 'fetch');

      try {
        await ApiService.get('/test');
      } catch (e) {
        // Expected to throw
      }

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('timeout mapping', () => {
    it('maps AbortError to user-friendly timeout message', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';

      jest.spyOn(global, 'fetch').mockRejectedValue(abortError);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Request timed out. The file may be too large or the server is busy. Please try again.'
      );
    });
  });

  describe('non-JSON error responses', () => {
    it('maps 401 non-JSON to authentication failed message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 401,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        },
        text: async () => '<html>Unauthorized</html>',
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Authentication failed. Please sign in again.'
      );
    });

    it('maps 403 non-JSON to access denied message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 403,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        },
        text: async () => '<html>Forbidden</html>',
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Access denied. You do not have permission to access this resource.'
      );
    });

    it('maps 429 non-JSON to rate limit message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/plain' : null),
        },
        text: async () => 'Rate limit exceeded',
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Too many requests. Please wait a moment and try again.'
      );
    });

    it('maps 413 to file too large message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 413,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/plain' : null),
        },
        text: async () => 'Payload too large',
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'File too large. Please try a smaller file or split your content into multiple files.'
      );
    });

    it('maps 500 non-JSON to server error message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 500,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'text/html' : null),
        },
        text: async () => '<html>Internal Server Error</html>',
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Server error. Please try again later.'
      );
    });

    it('maps 502 non-JSON to server unavailable message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 502,
        headers: {
          get: (name: string) => (name === 'content-type' ? null : null),
        },
        text: async () => 'Bad Gateway',
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Server temporarily unavailable. Please try again later.'
      );
    });

    it('maps 503 non-JSON to service unavailable message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 503,
        headers: {
          get: (name: string) => null,
        },
        text: async () => 'Service Unavailable',
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Service temporarily unavailable. Please try again later.'
      );
    });

    it('maps 504 non-JSON to timeout message', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 504,
        headers: {
          get: () => null,
        },
        text: async () => 'Gateway Timeout',
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Request timed out. Please try again.'
      );
    });

    it('provides generic message for unmapped status codes', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 418,
        headers: {
          get: () => 'text/plain',
        },
        text: async () => "I'm a teapot",
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Request failed with status 418'
      );
    });
  });

  describe('JSON success responses', () => {
    it('resolves with data payload when success is true', async () => {
      const mockData = { userId: '123', name: 'Test User' };
      
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          success: true,
          data: mockData,
        }),
      } as any);

      const result = await ApiService.get<typeof mockData>('/test');
      expect(result).toEqual(mockData);
    });

    it('rejects with error message when success is false', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) => (name === 'content-type' ? 'application/json' : null),
        },
        json: async () => ({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
          },
        }),
      } as any);

      await expect(ApiService.get('/test')).rejects.toThrow('Invalid input data');
    });

    it('includes auth token in request headers', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ success: true, data: {} }),
      } as any);

      await ApiService.get('/test');

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://test-api.example.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token-123',
          }),
        })
      );
    });
  });

  describe('network failures', () => {
    it('maps "Failed to fetch" to server unreachable message', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Failed to fetch'));

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Unable to connect to the server. Please check your internet connection.'
      );
    });

    it('maps "Network request failed" to server unreachable message', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network request failed'));

      await expect(ApiService.get('/test')).rejects.toThrow(
        'Unable to connect to the server. Please check your internet connection.'
      );
    });
  });

  describe('checkHealth', () => {
    it('returns true when health endpoint succeeds', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      const result = await ApiService.checkHealth();
      expect(result).toBe(true);
    });

    it('returns false on timeout', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      jest.spyOn(global, 'fetch').mockRejectedValue(abortError);

      const result = await ApiService.checkHealth();
      expect(result).toBe(false);
    });

    it('returns false on other errors', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

      const result = await ApiService.checkHealth();
      expect(result).toBe(false);
    });

    it('does not require authentication', async () => {
      // Make auth return no user
      (auth as jest.Mock).mockReturnValue({
        currentUser: null,
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } as any);

      const result = await ApiService.checkHealth();
      expect(result).toBe(true);
    });
  });

  describe('POST requests', () => {
    it('sends body as JSON', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ success: true, data: {} }),
      } as any);

      const body = { key: 'value' };
      await ApiService.post('/test', body);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://test-api.example.com/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
        })
      );
    });

    it('uses longer timeout for /parse/ endpoints', async () => {
      // TODO: This test only verifies fetch is called, not the actual timeout value
      // To properly test: either mock AbortController to capture timeout, or refactor
      // to inject timeout config for testability. For now, this is a smoke test.
      // The code sets 600000ms (10min) for /parse/ and /ai/ vs 120000ms (2min) default.
      
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ success: true, data: {} }),
      } as any);

      await ApiService.post('/parse/document', {});

      // Weak assertion - only checks endpoint works, not timeout value
      expect(fetchSpy).toHaveBeenCalled();
      
      // IMPROVEMENT NEEDED: Assert on AbortController timeout or inject timeout config
    });
  });

  describe('not authenticated', () => {
    it('throws when no current user', async () => {
      (auth as jest.Mock).mockReturnValue({
        currentUser: null,
      });

      await expect(ApiService.get('/test')).rejects.toThrow('Not authenticated');
    });

    it('throws when getIdToken returns null', async () => {
      mockAuthUser.getIdToken.mockResolvedValue(null);

      await expect(ApiService.get('/test')).rejects.toThrow('Not authenticated');
    });
  });
});
