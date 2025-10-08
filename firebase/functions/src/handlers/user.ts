import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { logger } from 'firebase-functions/v2';

/**
 * Get current user info (test authenticated endpoint)
 */
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  const user = (req as AuthenticatedRequest).user;
  
  logger.info('User info requested', { uid: user.uid });
  
  res.json({
    success: true,
    data: {
      uid: user.uid,
      email: user.email,
      premium: user.premium || false,
    },
  });
}
