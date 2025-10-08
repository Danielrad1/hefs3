import { Request, Response } from 'express';

/**
 * Health check endpoint
 */
export async function healthCheck(req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: Date.now(),
      version: '1.0.0',
    },
  });
}
