import { z } from 'zod';

// API Response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// Decoded Firebase token
export interface DecodedToken {
  uid: string;
  email?: string;
  premium?: boolean;
  [key: string]: any;
}

// Request validation schemas
export const BackupUrlRequestSchema = z.object({
  op: z.enum(['put', 'get']),
  filename: z.string().optional().default('latest.db'),
  history: z.boolean().optional().default(false),
});

export type BackupUrlRequest = z.infer<typeof BackupUrlRequestSchema>;
