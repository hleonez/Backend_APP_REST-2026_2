import { NextFunction, Request, RequestHandler, Response } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const createRateLimiter = (windowMs: number, limit: number): RequestHandler => {
  const entries = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = entries.get(key);

    if (!current || current.resetAt <= now) {
      entries.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (current.count >= limit) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      res.status(429).json({ message: 'Demasiadas solicitudes. Intenta nuevamente más tarde.' });
      return;
    }

    current.count += 1;
    next();
  };
};

export const loginRateLimiter = createRateLimiter(60_000, 5);
export const registerRateLimiter = createRateLimiter(60_000, 3);
export const passwordResetRateLimiter = createRateLimiter(60 * 60_000, 3);