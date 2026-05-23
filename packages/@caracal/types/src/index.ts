export type EnvironmentName = 'development' | 'test' | 'staging' | 'production';

export interface ServiceHealth {
  status: 'ok' | 'degraded' | 'error';
  service: string;
  version: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
