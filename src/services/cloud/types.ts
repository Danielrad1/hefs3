/**
 * Shared types for cloud services
 */

export interface UserInfo {
  uid: string;
  email?: string;
  premium: boolean;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  timestamp: number;
  version: string;
}
