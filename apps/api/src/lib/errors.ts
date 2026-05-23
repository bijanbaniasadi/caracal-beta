export class AppError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: string, message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError('bad_request', message, 400, details);
}

export function tooManyRequests(message = 'Too many requests'): AppError {
  return new AppError('rate_limited', message, 429);
}
