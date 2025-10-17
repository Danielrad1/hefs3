import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { getUserUsage } from '../middleware/quota';
import { logger } from '../utils/logger';

/**
 * GET /usage
 * Get current month's usage for the authenticated user
 */
export const getUsage = async (req: Request, res: Response) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const usage = await getUserUsage(user.uid);

    return res.json({
      success: true,
      data: usage,
    });
  } catch (error) {
    logger.error('[Usage] Error fetching usage:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch usage data',
      },
    });
  }
};
