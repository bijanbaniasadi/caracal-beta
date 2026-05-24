import type { AuthenticatedPrincipal } from '../lib/auth.js';

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedPrincipal;
    }
  }
}

export {};
