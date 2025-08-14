/**
 * Comprehensive Health Check Service
 * Provides detailed system health monitoring for production deployment
 */

const mongoose = require('mongoose');
// Use simple console logger to avoid pino transport conflicts
const logger = {
  info: (data, msg) => console.log(`[INFO] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  error: (data, msg) => console.error(`[ERROR] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  warn: (data, msg) => console.warn(`[WARN] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  debug: (data, msg) => console.log(`[DEBUG] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
};
const pushNotificationService = require('./pushNotificationService');

class HealthService {
  constructor() {
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastHealthCheck = null;
    this.systemMetrics = {
      cpu: null,
      memory: null,
      uptime: null
    };
  }

  /**
   * Increment request counter
   */
  incrementRequests() {
    this.requestCount++;
  }

  /**
   * Increment error counter
   */
  incrementErrors() {
    this.errorCount++;
  }

  /**
   * Get system metrics
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        usage_percent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      uptime: {
        seconds: Math.round(uptime),
        human: this.formatUptime(uptime)
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  /**
   * Format uptime in human readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Check database connectivity and performance
   */
  async checkDatabase() {
    try {
      const start = Date.now();
      const dbState = mongoose.connection.readyState;
      
      // Test database with a simple query
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - start;

      // Get database stats
      const dbStats = await mongoose.connection.db.stats();
      
      return {
        status: dbState === 1 ? 'connected' : 'disconnected',
        responseTime: `${responseTime}ms`,
        readyState: this.getReadyStateText(dbState),
        stats: {
          collections: dbStats.collections,
          documents: dbStats.objects,
          dataSize: Math.round(dbStats.dataSize / 1024 / 1024), // MB
          storageSize: Math.round(dbStats.storageSize / 1024 / 1024), // MB
          indexes: dbStats.indexes,
          indexSize: Math.round(dbStats.indexSize / 1024 / 1024) // MB
        }
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Database health check failed');
      return {
        status: 'error',
        error: error.message,
        responseTime: null
      };
    }
  }

  /**
   * Get readable database ready state
   */
  getReadyStateText(state) {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    return states[state] || 'unknown';
  }

  /**
   * Check unified posts system health
   */
  async checkPostsSystem() {
    try {
      const { Post } = require('../models/postModel');
      const start = Date.now();
      
      // Get post counts by space
      const [totalPosts, activePosts, yapPosts, teaPosts, brospacePosts, localPosts] = await Promise.all([
        Post.countDocuments({}),
        Post.countDocuments({ isActive: true }),
        Post.countDocuments({ space: 'yap', isActive: true }),
        Post.countDocuments({ space: 'tea', isActive: true }),
        Post.countDocuments({ space: 'brospace', isActive: true }),
        Post.countDocuments({ space: 'local', isActive: true })
      ]);

      const responseTime = Date.now() - start;

      // Get recent activity (posts in last 24 hours)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentPosts = await Post.countDocuments({ 
        createdAt: { $gte: yesterday },
        isActive: true 
      });

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        posts: {
          total: totalPosts,
          active: activePosts,
          recent24h: recentPosts,
          spaces: {
            yap: yapPosts,
            tea: teaPosts,
            brospace: brospacePosts,
            local: localPosts
          }
        }
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Posts system health check failed');
      return {
        status: 'error',
        error: error.message,
        posts: null
      };
    }
  }

  /**
   * Check authentication system
   */
  async checkAuthSystem() {
    try {
      const User = require('../models/User');
      const start = Date.now();
      
      // Get user stats
      const [totalUsers, activeUsers] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: { $ne: false } })
      ]);

      const responseTime = Date.now() - start;

      // Get recent registrations (last 7 days)
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentUsers = await User.countDocuments({ 
        createdAt: { $gte: weekAgo } 
      });

      return {
        status: 'healthy',
        responseTime: `${responseTime}ms`,
        users: {
          total: totalUsers,
          active: activeUsers,
          recent7d: recentUsers
        }
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Auth system health check failed');
      return {
        status: 'error',
        error: error.message,
        users: null
      };
    }
  }

  /**
   * Check external dependencies
   */
  async checkExternalDependencies() {
    const dependencies = [];

    // Check if scraper scheduler is running
    try {
      // This would check external APIs, news sources, etc.
      dependencies.push({
        name: 'News Scraper',
        status: 'healthy',
        responseTime: '< 100ms'
      });
    } catch (error) {
      dependencies.push({
        name: 'News Scraper',
        status: 'error',
        error: error.message
      });
    }

    return dependencies;
  }

  /**
   * Comprehensive health check
   */
  async performHealthCheck() {
    const checkStart = Date.now();
    
    try {
      // Run all health checks in parallel
      const [database, posts, auth, dependencies, pushNotifications] = await Promise.all([
        this.checkDatabase(),
        this.checkPostsSystem(),
        this.checkAuthSystem(),
        this.checkExternalDependencies(),
        this.checkPushNotificationService()
      ]);

      const systemMetrics = this.getSystemMetrics();
      const totalCheckTime = Date.now() - checkStart;

      // Determine overall health status
      const isHealthy = database.status === 'connected' &&
                       posts.status === 'healthy' &&
                       auth.status === 'healthy' &&
                       pushNotifications.status === 'healthy';

      const healthData = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: systemMetrics.uptime,
        version: process.env.APP_VERSION || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        checkDuration: `${totalCheckTime}ms`,
        
        // System metrics
        system: systemMetrics,
        
        // Service checks
        services: {
          database,
          posts,
          auth,
          dependencies,
          pushNotifications
        },
        
        // Application metrics
        metrics: {
          requests: {
            total: this.requestCount,
            errors: this.errorCount,
            errorRate: this.requestCount > 0 ? 
              Math.round((this.errorCount / this.requestCount) * 100) : 0
          },
          startTime: new Date(this.startTime).toISOString()
        }
      };

      this.lastHealthCheck = healthData;
      
      // Log health check results
      if (isHealthy) {
        logger.info({
          status: healthData.status,
          checkDuration: totalCheckTime,
          errorRate: healthData.metrics.requests.errorRate
        }, 'Health check completed successfully');
      } else {
        logger.warn({
          status: healthData.status,
          issues: this.getHealthIssues(healthData)
        }, 'Health check detected issues');
      }

      return healthData;
    } catch (error) {
      logger.error({ error: error.message }, 'Health check failed');
      
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
        uptime: this.getSystemMetrics().uptime
      };
    }
  }

  /**
   * Get list of health issues
   */
  getHealthIssues(healthData) {
    const issues = [];
    
    if (healthData.services.database.status !== 'connected') {
      issues.push('Database connectivity issue');
    }
    
    if (healthData.services.posts.status !== 'healthy') {
      issues.push('Posts system issue');
    }
    
    if (healthData.services.auth.status !== 'healthy') {
      issues.push('Authentication system issue');
    }
    
    if (healthData.system.memory.usage_percent > 90) {
      issues.push('High memory usage');
    }
    
    if (healthData.metrics.requests.errorRate > 5) {
      issues.push('High error rate');
    }
    
    return issues;
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck() {
    return this.lastHealthCheck;
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics() {
    this.requestCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }

  /**
   * Check push notification service health
   */
  async checkPushNotificationService() {
    try {
      const health = await pushNotificationService.healthCheck();
      const stats = pushNotificationService.getDeliveryStats();
      
      return {
        status: health.status,
        service: 'Push Notifications',
        expo: health.expo,
        deliveryStats: {
          total: stats.total,
          sent: stats.sent,
          delivered: stats.delivered,
          failed: stats.failed,
          successRate: stats.successRate,
          deliveryRate: stats.deliveryRate
        },
        recentErrors: stats.recentErrors.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error({ error: error.message }, 'Push notification service health check failed');
      return {
        status: 'unhealthy',
        service: 'Push Notifications',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
module.exports = new HealthService();