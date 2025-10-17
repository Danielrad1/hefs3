import { logger as functionsLogger } from 'firebase-functions';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Redact potentially sensitive data from logs
   * NEVER log full AI prompts, responses, or user content in production
   */
  private redact(data: any): any {
    if (typeof data === 'string') {
      // In production, truncate long strings that might contain user content
      if (this.isProduction() && data.length > 200) {
        return `[REDACTED - ${data.length} chars]`;
      }
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      const redacted: any = Array.isArray(data) ? [] : {};
      for (const key in data) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('token') || 
            lowerKey.includes('key') || 
            lowerKey.includes('password') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('prompt') ||
            lowerKey.includes('response') ||
            lowerKey.includes('content')) {
          redacted[key] = this.isProduction() ? '[REDACTED]' : data[key];
        } else {
          redacted[key] = data[key];
        }
      }
      return redacted;
    }
    
    return data;
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    const isProd = this.isProduction();
    
    // In production, only log warnings and errors
    if (isProd && (level === 'debug' || level === 'info')) {
      return;
    }
    
    // Redact sensitive data
    const safeArgs = args.map(arg => this.redact(arg));
    
    // Use Firebase Functions logger for proper Cloud Logging integration
    switch (level) {
      case 'debug':
        functionsLogger.debug(message, ...safeArgs);
        break;
      case 'info':
        functionsLogger.info(message, ...safeArgs);
        break;
      case 'warn':
        functionsLogger.warn(message, ...safeArgs);
        break;
      case 'error':
        functionsLogger.error(message, ...safeArgs);
        break;
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }
}

export const logger = new Logger();
