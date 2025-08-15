/**
 * Upstash-only Redis client + tiny helpers
 * Clean REST API implementation without ioredis compatibility layer
 * Falls back to in-memory cache when Redis is not available (CI/test environments)
 */

const { Redis } = require('@upstash/redis');

// HARD SHORT-CIRCUIT for CI - no external calls in TEST_MODE
const TEST_MODE = process.env.TEST_MODE === 'true';

if (TEST_MODE) {
  console.log('🚫 TEST_MODE: All Redis operations are NO-OPS (no external calls)');
}

// In-memory fallback for CI/test environments
const memoryCache = new Map();

// Check if Redis credentials are available (only if not in TEST_MODE)
const hasRedisCredentials = !TEST_MODE && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = hasRedisCredentials ? new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
}) : null;

console.log(`🔧 Redis client: ${TEST_MODE ? 'NO-OP (TEST_MODE)' : hasRedisCredentials ? 'Upstash Redis' : 'In-memory fallback'}`);

// JSON helpers (stringify/parse)
async function rSetJSON(key, value, options = {}) {
  if (TEST_MODE) return 'OK'; // HARD SHORT-CIRCUIT - no external calls
  
  if (!redis) {
    // In-memory fallback
    memoryCache.set(key, JSON.stringify(value));
    if (options.ex) {
      setTimeout(() => memoryCache.delete(key), options.ex * 1000);
    }
    return 'OK';
  }
  
  const args = options.ex ? { ex: options.ex } : undefined; // NOTE: lower-case 'ex' for Upstash
  return await redis.set(key, JSON.stringify(value), args);
}

async function rGetJSON(key) {
  if (TEST_MODE) return null; // HARD SHORT-CIRCUIT - no external calls
  
  if (!redis) {
    // In-memory fallback
    const val = memoryCache.get(key);
    if (val === null || val === undefined) return null;
    return typeof val === 'string' ? JSON.parse(val) : val;
  }
  
  const val = await redis.get(key);
  if (val === null || val === undefined) return null;
  return typeof val === 'string' ? JSON.parse(val) : val;
}

// Simple counters (for cache stats / metrics)
async function rIncr(key, options = {}) {
  if (TEST_MODE) return 1; // HARD SHORT-CIRCUIT - no external calls
  
  if (!redis) {
    // In-memory fallback
    const current = parseInt(memoryCache.get(key) || '0');
    const newVal = current + 1;
    memoryCache.set(key, String(newVal));
    if (options.ex) {
      setTimeout(() => memoryCache.delete(key), options.ex * 1000);
    }
    return newVal;
  }
  
  const n = await redis.incr(key);
  if (options.ex) await redis.expire(key, options.ex);
  return n;
}

async function rExpire(key, seconds) {
  if (TEST_MODE) return 1; // HARD SHORT-CIRCUIT - no external calls
  
  if (!redis) {
    // In-memory fallback
    setTimeout(() => memoryCache.delete(key), seconds * 1000);
    return 1;
  }
  
  return await redis.expire(key, seconds);
}

module.exports = {
  redis: redis || {
    // Mock Redis interface for in-memory fallback
    status: 'ready',
    keys: async (pattern) => Array.from(memoryCache.keys()).filter(k => k.includes(pattern.replace('*', ''))),
    get: async (key) => memoryCache.get(key) || null,
    set: async (key, value, options) => { memoryCache.set(key, value); return 'OK'; },
    del: async (...keys) => { keys.forEach(k => memoryCache.delete(k)); return keys.length; },
    ttl: async (key) => memoryCache.has(key) ? 3600 : -1, // Mock TTL
    ping: async () => 'PONG'
  },
  rSetJSON,
  rGetJSON,
  rIncr,
  rExpire
};