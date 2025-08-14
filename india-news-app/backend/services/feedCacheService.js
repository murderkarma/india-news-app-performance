/**
 * Feed Cache Service
 * 30-60s Redis cache for GET /api/posts by {space, cursor} with invalidation
 */

const { redis, rGetJSON, rSetJSON } = require('../config/redisClient');

class FeedCacheService {
  constructor() {
    this.defaultTTL = 60; // 60 seconds default cache
    this.shortTTL = 30;   // 30 seconds for high-activity spaces
    this.keyPrefix = 'feed:';
  }

  /**
   * Generate cache key for feed request
   */
  generateKey(space, cursor = '', limit = 20, filters = {}) {
    const filterStr = Object.keys(filters).length > 0 ? 
      ':' + JSON.stringify(filters) : '';
    return `${this.keyPrefix}${space}:${cursor}:${limit}${filterStr}`;
  }

  /**
   * Get cached feed data
   */
  async get(space, cursor = '', limit = 20, filters = {}) {
    try {
      const key = this.generateKey(space, cursor, limit, filters);
      const cached = await rGetJSON(key);
      
      if (cached) {
        console.log(`📋 Cache HIT for ${space} feed (cursor: ${cursor})`);
        return cached;
      }
      
      console.log(`📋 Cache MISS for ${space} feed (cursor: ${cursor})`);
      return null;
    } catch (error) {
      console.warn('Feed cache GET error:', error.message);
      return null;
    }
  }

  /**
   * Cache feed data with appropriate TTL
   */
  async set(space, cursor = '', limit = 20, filters = {}, data) {
    try {
      const key = this.generateKey(space, cursor, limit, filters);
      const ttl = this.getTTLForSpace(space);
      
      await rSetJSON(key, data, { ex: ttl });
      console.log(`📋 Cache SET for ${space} feed (TTL: ${ttl}s)`);
      
      return true;
    } catch (error) {
      console.warn('Feed cache SET error:', error.message);
      return false;
    }
  }

  /**
   * Get TTL based on space activity level
   */
  getTTLForSpace(space) {
    // High-activity spaces get shorter cache
    const highActivitySpaces = ['yap', 'brospace'];
    return highActivitySpaces.includes(space) ? this.shortTTL : this.defaultTTL;
  }

  /**
   * Invalidate cache when new post is created in space
   */
  async invalidateSpace(space) {
    try {
      const pattern = `${this.keyPrefix}${space}:*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`📋 Cache INVALIDATED for ${space} (${keys.length} keys)`);
      }
      
      return keys.length;
    } catch (error) {
      console.warn('Feed cache invalidation error:', error.message);
      return 0;
    }
  }

  /**
   * Invalidate all feed caches (for major updates)
   */
  async invalidateAll() {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`📋 Cache INVALIDATED ALL feeds (${keys.length} keys)`);
      }
      
      return keys.length;
    } catch (error) {
      console.warn('Feed cache full invalidation error:', error.message);
      return 0;
    }
  }

  /**
   * Warm cache for popular feeds
   */
  async warmCache(feedData) {
    const promises = [];
    
    // Warm cache for each space without cursor (first page)
    const spaces = ['yap', 'tea', 'brospace', 'local'];
    
    for (const space of spaces) {
      if (feedData[space]) {
        promises.push(this.set(space, '', 20, {}, feedData[space]));
      }
    }
    
    try {
      await Promise.all(promises);
      console.log('📋 Cache warmed for all spaces');
    } catch (error) {
      console.warn('Cache warming error:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await redis.keys(pattern);
      
      const stats = {
        totalKeys: keys.length,
        bySpace: {},
        keyDetails: []
      };
      
      // Analyze keys by space
      for (const key of keys) {
        const parts = key.replace(this.keyPrefix, '').split(':');
        const space = parts[0];
        
        if (!stats.bySpace[space]) {
          stats.bySpace[space] = 0;
        }
        stats.bySpace[space]++;
        
        // Get TTL for each key
        const ttl = await redis.ttl(key);
        stats.keyDetails.push({
          key: key.replace(this.keyPrefix, ''),
          space,
          ttl
        });
      }
      
      return stats;
    } catch (error) {
      console.warn('Cache stats error:', error.message);
      return { totalKeys: 0, bySpace: {}, keyDetails: [] };
    }
  }

  /**
   * Clear expired keys manually (Redis handles this automatically)
   */
  async cleanup() {
    try {
      const pattern = `${this.keyPrefix}*`;
      const keys = await redis.keys(pattern);
      let cleaned = 0;
      
      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -1) { // Key exists but has no TTL
          await redis.del(key);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`📋 Cache cleanup: removed ${cleaned} keys without TTL`);
      }
      
      return cleaned;
    } catch (error) {
      console.warn('Cache cleanup error:', error.message);
      return 0;
    }
  }
}

// Export singleton instance
module.exports = new FeedCacheService();