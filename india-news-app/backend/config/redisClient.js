/**
 * Upstash-only Redis client + tiny helpers
 * Clean REST API implementation without ioredis compatibility layer
 */

const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// JSON helpers (stringify/parse)
async function rSetJSON(key, value, options = {}) {
  const args = options.ex ? { ex: options.ex } : undefined; // NOTE: lower-case 'ex' for Upstash
  return await redis.set(key, JSON.stringify(value), args);
}

async function rGetJSON(key) {
  const val = await redis.get(key);
  if (val === null || val === undefined) return null;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

// Simple counters (for cache stats / metrics)
async function rIncr(key, options = {}) {
  const n = await redis.incr(key);
  if (options.ex) await redis.expire(key, options.ex);
  return n;
}

async function rExpire(key, seconds) {
  return await redis.expire(key, seconds);
}

module.exports = {
  redis,
  rSetJSON,
  rGetJSON,
  rIncr,
  rExpire
};