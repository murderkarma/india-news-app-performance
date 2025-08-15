/**
 * Redis-Backed JWT Authentication Middleware
 * Eliminates per-request database queries through intelligent claims caching
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { rGetJSON, rSetJSON } = require('../config/redisClient');

/**
 * High-performance authentication middleware with Redis JWT claims cache
 * Key strategy: jwt:{hash} -> cached user claims
 * TTL: JWT expiry - 60s buffer
 */
module.exports = async function auth(req, res, next) {
  try {
    // Extract Bearer token
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Generate stable cache key from token hash
    const cacheKey = `jwt:${crypto.createHash('sha256').update(token).digest('hex')}`;
    
    // 1) Try Redis cache first (eliminates DB hit)
    try {
      const cached = await rGetJSON(cacheKey);
      if (cached) {
        req.user = cached;
        return next();
      }
    } catch (cacheError) {
      // Cache miss or Redis error - continue to JWT verification
      console.warn('Redis cache miss or error:', cacheError.message);
    }

    // 2) Verify JWT (only on cache miss)
    const payload = jwt.verify(token, process.env.JWT_SECRET, { 
      clockTolerance: 5 // Allow 5s clock skew
    });

    // 3) Extract minimal claims (no DB query needed)
    const claims = {
      sub: payload.sub || payload.userId, // Handle both formats
      id: payload.sub || payload.userId, // Backward compatibility
      userId: payload.userId || payload.sub, // Support legacy field
      role: payload.role || 'user',
      gender: payload.gender,
      state: payload.state,
      username: payload.username,
      // Add any other claims stored in JWT
      spaces: payload.spaces || []
    };

    // 4) Cache claims with TTL based on JWT expiry
    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(1, payload.exp - now - 60); // 60s buffer before expiry
    
    try {
      await rSetJSON(cacheKey, claims, { ex: ttl });
    } catch (cacheError) {
      // Cache write failure - log but don't fail request
      console.warn('Redis cache write failed:', cacheError.message);
    }

    // 5) Set user claims and continue
    req.user = claims;
    return next();

  } catch (error) {
    // JWT verification failed or other auth error
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else {
      console.error('Auth middleware error:', error.message);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }
};

/**
 * Optional auth middleware (for endpoints that work with or without auth)
 */
module.exports.optional = async function optionalAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    
    if (!token) {
      req.user = null;
      return next();
    }

    // Use same caching logic as required auth
    const cacheKey = `jwt:${crypto.createHash('sha256').update(token).digest('hex')}`;
    
    try {
      const cached = await rGetJSON(cacheKey);
      if (cached) {
        req.user = cached;
        return next();
      }
    } catch (cacheError) {
      // Continue to JWT verification
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, { clockTolerance: 5 });
    const claims = {
      sub: payload.sub || payload.userId, // Handle both formats
      id: payload.sub || payload.userId, // Backward compatibility
      userId: payload.userId || payload.sub, // Support legacy field
      role: payload.role || 'user',
      gender: payload.gender,
      state: payload.state,
      username: payload.username,
      spaces: payload.spaces || []
    };

    const now = Math.floor(Date.now() / 1000);
    const ttl = Math.max(1, payload.exp - now - 60);
    
    try {
      await rSetJSON(cacheKey, claims, { ex: ttl });
    } catch (cacheError) {
      console.warn('Redis cache write failed:', cacheError.message);
    }

    req.user = claims;
    return next();

  } catch (error) {
    // For optional auth, continue without user if token is invalid
    req.user = null;
    return next();
  }
};

/**
 * Bypass auth for health checks and monitoring
 */
module.exports.bypass = function bypassAuth(req, res, next) {
  req.user = { 
    id: 'system', 
    role: 'system',
    bypass: true 
  };
  return next();
};