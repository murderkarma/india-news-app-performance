/**
 * Clean Upstash Rate Limiting
 * Uses @upstash/ratelimit with proper test mode bypass
 */

const { Ratelimit } = require('@upstash/ratelimit');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Write limiter: 120/min for testing, tune down later
const writeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
  analytics: true,
  prefix: 'rl:write',
});

// Read limiter: very high to avoid throttling feeds in tests
const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(1200, '1 m'),
  analytics: true,
  prefix: 'rl:read',
});

function bypass(req) {
  return process.env.TEST_MODE === 'true' || req.headers['x-load-test'] === '1';
}

function limitWrites() {
  return async (req, res, next) => {
    if (bypass(req)) return next();
    
    try {
      const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
      const { success, limit, remaining, reset } = await writeLimiter.limit(key);
      
      res.set('X-RateLimit-Limit', String(limit));
      res.set('X-RateLimit-Remaining', String(remaining));
      res.set('X-RateLimit-Reset', String(reset));
      
      if (!success) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      
      next();
    } catch (error) {
      console.error('Write rate limit error:', error.message);
      // Continue without rate limiting if Redis fails
      next();
    }
  };
}

function limitReads() {
  return async (req, res, next) => {
    if (bypass(req)) return next();
    
    try {
      const key = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
      const { success } = await readLimiter.limit(key);
      
      if (!success) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      
      next();
    } catch (error) {
      console.error('Read rate limit error:', error.message);
      // Continue without rate limiting if Redis fails
      next();
    }
  };
}

module.exports = {
  limitWrites,
  limitReads
};