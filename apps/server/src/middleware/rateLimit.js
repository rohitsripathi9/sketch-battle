import { redis } from '../index.js';

/**
 * Redis-backed rate limiter
 * @param {string} key - Redis key for this rate limit
 * @param {number} maxRequests - Max allowed requests in window
 * @param {number} windowMs - Window in milliseconds
 * @returns {boolean} true if rate limited (too many requests)
 */
export async function isRateLimited(key, maxRequests, windowMs) {
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, windowMs);
    }
    return current > maxRequests;
  } catch (err) {
    console.error('Rate limit check failed:', err.message);
    return false; // fail open — don't block on Redis errors
  }
}

/**
 * Express middleware factory for rate limiting
 */
export function rateLimitMiddleware(keyFn, maxRequests, windowMs) {
  return async (req, res, next) => {
    const key = keyFn(req);
    const limited = await isRateLimited(key, maxRequests, windowMs);

    if (limited) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }

    next();
  };
}
