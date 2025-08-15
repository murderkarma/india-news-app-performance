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

// Absolute bypass function for CI
const isBypass = req => process.env.TEST_MODE === 'true' || req.headers['x-load-test'] === '1';

function limitWrites() {
  return async (req, res, next) => {
    // ABSOLUTE BYPASS for CI - no Redis calls, no delays
    if (isBypass(req)) {
      console.log(`🚫 ABSOLUTE BYPASS: Write limiter skipped for ${req.method} ${req.path}`);
      return next();
    }
    
    // Skip rate limiting if Redis credentials are missing
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.log('⚠️  Skipping write limiting - Redis credentials missing');
      return next();
    }
    
    try {
      const key = req.user?.id || req.ip || 'anon';
      const resLimit = await writeLimiter.limit(key);
      
      // IMMEDIATE 429 - NO BLOCKING, NO RETRY-AFTER
      if (!resLimit.success) {
        console.log(`🚫 Write rate limit exceeded for ${key} - returning 429 immediately`);
        return res.status(429).end();
      }
      
      return next();
    } catch (error) {
      console.error('Write rate limit error:', error.message);
      // Continue without rate limiting if Redis fails
      return next();
    }
  };
}

function limitReads() {
  return async (req, res, next) => {
    // ABSOLUTE BYPASS for CI - no Redis calls, no delays
    if (isBypass(req)) {
      console.log(`🚫 ABSOLUTE BYPASS: Read limiter skipped for ${req.method} ${req.path}`);
      return next();
    }
    
    // Skip rate limiting if Redis credentials are missing
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      console.log('⚠️  Skipping read limiting - Redis credentials missing');
      return next();
    }
    
    try {
      const key = req.user?.id || req.ip || 'anon';
      const resLimit = await readLimiter.limit(key);
      
      // IMMEDIATE 429 - NO BLOCKING, NO RETRY-AFTER
      if (!resLimit.success) {
        console.log(`🚫 Read rate limit exceeded for ${key} - returning 429 immediately`);
        return res.status(429).end();
      }
      
      return next();
    } catch (error) {
      console.error('Read rate limit error:', error.message);
      // Continue without rate limiting if Redis fails
      return next();
    }
  };
}

module.exports = {
  limitWrites,
  limitReads
};