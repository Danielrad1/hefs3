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
    
    (req as AuthenticatedRequest).user = decodedToken as DecodedToken;
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
 */
export function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user?.premium) {
    res.status(403).json({
      success: false,
      error: {
        code: errorCodes.FORBIDDEN,
        message: 'Premium subscription required',
      },
    });
    return;
  }
  
  next();
}
