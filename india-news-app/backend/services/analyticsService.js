/**
 * Analytics Service
 * Tracks API metrics, user activity, and system performance
 */

const { logger } = require('../config/logger');

class AnalyticsService {
  constructor() {
    this.metrics = {
      requests: {
        total: 0,
        byEndpoint: new Map(),
        byMethod: new Map(),
        byStatus: new Map(),
        bySpace: new Map(),
        errors: 0
      },
      users: {
        activeDaily: new Set(),
        activeSessions: new Map(),
        registrations: 0,
        logins: 0
      },
      posts: {
        created: 0,
        bySpace: new Map(),
        reactions: 0,
        comments: 0
      },
      performance: {
        responseTimeSum: 0,
        responseTimeCount: 0,
        slowQueries: 0,
        dbConnections: 0
      }
    };

    // Reset daily metrics at midnight
    this.setupDailyReset();
  }

  /**
   * Track API request
   */
  trackRequest(req, res, responseTime) {
    const endpoint = this.normalizeEndpoint(req.originalUrl);
    const method = req.method;
    const status = res.statusCode;
    const space = req.query?.space || req.body?.space;
    const userId = req.user?.id;

    // Increment counters
    this.metrics.requests.total++;
    this.incrementMap(this.metrics.requests.byEndpoint, endpoint);
    this.incrementMap(this.metrics.requests.byMethod, method);
    this.incrementMap(this.metrics.requests.byStatus, status);
    
    if (space) {
      this.incrementMap(this.metrics.requests.bySpace, space);
    }

    if (status >= 400) {
      this.metrics.requests.errors++;
    }

    // Track performance
    this.metrics.performance.responseTimeSum += responseTime;
    this.metrics.performance.responseTimeCount++;

    if (responseTime > 1000) { // Slow request > 1s
      this.metrics.performance.slowQueries++;
      logger.warn({
        endpoint,
        method,
        responseTime: `${responseTime}ms`,
        userId
      }, 'Slow API request detected');
    }

    // Track active users
    if (userId) {
      this.trackActiveUser(userId);
    }

    // Log analytics event
    logger.business('api_request', {
      endpoint,
      method,
      status,
      responseTime,
      userId,
      space
    });
  }

  /**
   * Track user activity
   */
  trackActiveUser(userId) {
    const today = new Date().toDateString();
    const userKey = `${userId}_${today}`;
    
    this.metrics.users.activeDaily.add(userKey);
    this.metrics.users.activeSessions.set(userId, Date.now());
  }

  /**
   * Track user registration
   */
  trackRegistration(userId, userAgent, ip) {
    this.metrics.users.registrations++;
    
    logger.business('user_registration', {
      userId,
      userAgent,
      ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track user login
   */
  trackLogin(userId, userAgent, ip, success = true) {
    if (success) {
      this.metrics.users.logins++;
      this.trackActiveUser(userId);
    }
    
    logger.business('user_login', {
      userId,
      userAgent,
      ip,
      success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track post creation
   */
  trackPostCreation(postId, space, userId) {
    this.metrics.posts.created++;
    this.incrementMap(this.metrics.posts.bySpace, space);
    
    logger.business('post_created', {
      postId,
      space,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track reaction
   */
  trackReaction(postId, reactionType, userId, space) {
    this.metrics.posts.reactions++;
    
    logger.business('post_reaction', {
      postId,
      reactionType,
      userId,
      space,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track comment
   */
  trackComment(postId, commentId, userId, space) {
    this.metrics.posts.comments++;
    
    logger.business('comment_created', {
      postId,
      commentId,
      userId,
      space,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track database performance
   */
  trackDbOperation(operation, collection, duration) {
    this.metrics.performance.dbConnections++;
    
    if (duration > 500) { // Slow DB query > 500ms
      logger.warn({
        operation,
        collection,
        duration: `${duration}ms`
      }, 'Slow database operation detected');
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const now = Date.now();
    const activeSessions = Array.from(this.metrics.users.activeSessions.entries())
      .filter(([_, lastSeen]) => now - lastSeen < 30 * 60 * 1000) // Active in last 30 minutes
      .length;

    return {
      timestamp: new Date().toISOString(),
      requests: {
        total: this.metrics.requests.total,
        errors: this.metrics.requests.errors,
        errorRate: this.metrics.requests.total > 0 ? 
          Math.round((this.metrics.requests.errors / this.metrics.requests.total) * 100) : 0,
        byEndpoint: Object.fromEntries(this.metrics.requests.byEndpoint),
        byMethod: Object.fromEntries(this.metrics.requests.byMethod),
        byStatus: Object.fromEntries(this.metrics.requests.byStatus),
        bySpace: Object.fromEntries(this.metrics.requests.bySpace)
      },
      users: {
        activeDaily: this.metrics.users.activeDaily.size,
        activeSessions,
        registrations: this.metrics.users.registrations,
        logins: this.metrics.users.logins
      },
      posts: {
        created: this.metrics.posts.created,
        reactions: this.metrics.posts.reactions,
        comments: this.metrics.posts.comments,
        bySpace: Object.fromEntries(this.metrics.posts.bySpace)
      },
      performance: {
        averageResponseTime: this.metrics.performance.responseTimeCount > 0 ?
          Math.round(this.metrics.performance.responseTimeSum / this.metrics.performance.responseTimeCount) : 0,
        slowQueries: this.metrics.performance.slowQueries,
        dbConnections: this.metrics.performance.dbConnections
      }
    };
  }

  /**
   * Get daily active users count
   */
  getDailyActiveUsers() {
    const today = new Date().toDateString();
    return Array.from(this.metrics.users.activeDaily)
      .filter(userKey => userKey.endsWith(today))
      .length;
  }

  /**
   * Get top endpoints by request count
   */
  getTopEndpoints(limit = 10) {
    return Array.from(this.metrics.requests.byEndpoint.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  /**
   * Get error rate by endpoint
   */
  getErrorRates() {
    const errorRates = new Map();
    
    // This would require more detailed tracking of errors per endpoint
    // For now, return overall error rate
    return {
      overall: this.metrics.requests.total > 0 ? 
        Math.round((this.metrics.requests.errors / this.metrics.requests.total) * 100) : 0
    };
  }

  /**
   * Export metrics for external analytics services
   */
  exportMetrics() {
    const metrics = this.getMetrics();
    
    // Format for PostHog/Mixpanel
    return {
      events: [
        {
          event: 'server_metrics',
          properties: metrics,
          timestamp: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * Reset daily metrics
   */
  resetDailyMetrics() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    // Remove yesterday's active users
    this.metrics.users.activeDaily = new Set(
      Array.from(this.metrics.users.activeDaily)
        .filter(userKey => !userKey.endsWith(yesterdayStr))
    );
    
    // Clean up old sessions (older than 24 hours)
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    for (const [userId, lastSeen] of this.metrics.users.activeSessions.entries()) {
      if (lastSeen < dayAgo) {
        this.metrics.users.activeSessions.delete(userId);
      }
    }
    
    logger.info('Daily metrics reset completed');
  }

  /**
   * Setup daily reset at midnight
   */
  setupDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.resetDailyMetrics();
      
      // Set up recurring daily reset
      setInterval(() => {
        this.resetDailyMetrics();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  /**
   * Normalize endpoint for consistent tracking
   */
  normalizeEndpoint(url) {
    // Remove query parameters and normalize dynamic segments
    return url
      .split('?')[0]
      .replace(/\/\d+/g, '/:id') // Replace numeric IDs
      .replace(/\/[a-f0-9]{24}/g, '/:id') // Replace MongoDB ObjectIds
      .toLowerCase();
  }

  /**
   * Helper to increment map values
   */
  incrementMap(map, key) {
    map.set(key, (map.get(key) || 0) + 1);
  }

  /**
   * Generate analytics report
   */
  generateReport() {
    const metrics = this.getMetrics();
    const topEndpoints = this.getTopEndpoints(5);
    
    return {
      summary: {
        totalRequests: metrics.requests.total,
        errorRate: `${metrics.requests.errorRate}%`,
        dailyActiveUsers: this.getDailyActiveUsers(),
        averageResponseTime: `${metrics.performance.averageResponseTime}ms`,
        postsCreated: metrics.posts.created,
        totalReactions: metrics.posts.reactions
      },
      topEndpoints,
      spaceActivity: metrics.posts.bySpace,
      performance: {
        slowQueries: metrics.performance.slowQueries,
        dbConnections: metrics.performance.dbConnections
      },
      generatedAt: new Date().toISOString()
    };
  }
}

// Export singleton instance
module.exports = new AnalyticsService();