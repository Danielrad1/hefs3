import Constants from 'expo-constants';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Check production status once at module load to avoid repeated checks
const IS_PRODUCTION = Constants.expoConfig?.extra?.environment === 'production';
const IS_DEV = __DEV__;
// Allow forcing verbose logs in production builds by setting extra.verboseLogs=true
const FORCE_VERBOSE = (Constants.expoConfig?.extra as any)?.verboseLogs === true;

/**
 * Optimized logger that is truly silent in production
 * - Zero overhead for debug/info in production (no-op)
 * - Minimal overhead for warn/error in production
 * - Full logging in development
 */
class Logger {
  /**
   * Redact potentially sensitive data from logs (only in production)
   */
  private redact(data: any): any {
    if (typeof data === 'string') {
      // Redact tokens and API keys
      if (data.length > 100) {
        return `[REDACTED - ${data.length} chars]`;
      }
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      const redacted: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        if (key.toLowerCase().includes('token') || 
            key.toLowerCase().includes('key') || 
            key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret')) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = data[key];
        }
      }
      return redacted;
    }
    
    return data;
  }

  debug(message: string, ...args: any[]): void {
    // Silent in production unless FORCE_VERBOSE is enabled
    if (IS_PRODUCTION && !FORCE_VERBOSE) return;
    if (IS_DEV || FORCE_VERBOSE) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    // Silent in production unless FORCE_VERBOSE is enabled
    if (IS_PRODUCTION && !FORCE_VERBOSE) return;
    if (IS_DEV || FORCE_VERBOSE) {
      console.log(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    // Only warnings in production
    if (IS_PRODUCTION) {
      const safeArgs = args.map(arg => this.redact(arg));
      console.warn(message, ...safeArgs);
    } else {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    // Only errors in production
    if (IS_PRODUCTION) {
      const safeArgs = args.map(arg => this.redact(arg));
      console.error(message, ...safeArgs);
    } else {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
