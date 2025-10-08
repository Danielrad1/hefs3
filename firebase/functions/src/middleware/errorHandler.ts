import { Request, Response, NextFunction } from 'express';
import { logger } from 'firebase-functions/v2';

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Request error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  const statusCode = error.statusCode || 500;
  const code = error.code || 'internal_error';
  const message = error.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
