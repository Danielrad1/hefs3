import { Request, Response, NextFunction } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { DecodedToken } from '../types';
import { errorCodes } from '../config/constants';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user: DecodedToken;
}

/**
 * Middleware to verify Firebase ID token
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Auto-detect emulator mode and bypass auth
    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
    if (isEmulator) {
      logger.warn('[Auth] 🔧 Running in EMULATOR mode - bypassing authentication');
      (req as AuthenticatedRequest).user = {
        uid: 'emulator-user',
        email: 'dev@emulator.local',
        premium: true, // Free version: everyone is premium
      } as DecodedToken;
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: errorCodes.UNAUTHORIZED,
          message: 'Missing or invalid authorization header',
        },
      });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth().verifyIdToken(token);
    
    // Extract custom claims (including premium status)
    const user: DecodedToken = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      premium: true, // Free version: everyone is premium
    } as DecodedToken;
    
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    logger.error('[Auth] Token verification failed:', error);
    res.status(401).json({
      success: false,
      error: {
        code: errorCodes.UNAUTHORIZED,
        message: 'Invalid or expired token',
      },
    });
  }
}

/**
 * Middleware to require premium subscription
 * Free version: no-op, everyone is premium
 */
export function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Free version: everyone is premium, just continue
  next();
}
