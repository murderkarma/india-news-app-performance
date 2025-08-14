/**
 * Simplified Logger Configuration for Load Testing
 */

const pino = require('pino');

// Simple console logger for development/testing
const logger = pino({
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// Enhanced logging methods
const enhancedLogger = {
  ...logger,
  
  // API request logging
  apiRequest: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      responseTime: `${responseTime}ms`,
      statusCode: res.statusCode,
      userId: req.user?.id,
      space: req.query?.space || req.body?.space
    };

    if (res.statusCode >= 400) {
      logger.error(logData, 'API Request Error');
    } else {
      logger.info(logData, 'API Request Success');
    }
  },

  // Database operation logging
  dbOperation: (operation, collection, duration, error = null) => {
    const logData = {
      operation,
      collection,
      duration: `${duration}ms`,
      ...(error && { error: error.message })
    };

    if (error) {
      logger.error(logData, 'Database Operation Failed');
    } else {
      logger.debug(logData, 'Database Operation Success');
    }
  },

  // Authentication logging
  auth: (event, userId, ip, userAgent, success = true, error = null) => {
    const logData = {
      event,
      userId,
      ip,
      userAgent,
      success,
      ...(error && { error: error.message })
    };

    if (!success) {
      logger.warn(logData, 'Authentication Failed');
    } else {
      logger.info(logData, 'Authentication Success');
    }
  },

  // Security event logging
  security: (event, severity, details) => {
    const logData = {
      event,
      severity,
      ...details,
      timestamp: new Date().toISOString()
    };

    if (severity === 'high') {
      logger.error(logData, 'Security Event - High Severity');
    } else if (severity === 'medium') {
      logger.warn(logData, 'Security Event - Medium Severity');
    } else {
      logger.info(logData, 'Security Event - Low Severity');
    }
  },

  // Performance monitoring
  performance: (metric, value, context = {}) => {
    const logData = {
      metric,
      value,
      unit: context.unit || 'ms',
      ...context
    };

    logger.info(logData, 'Performance Metric');
  },

  // Business logic logging
  business: (event, data) => {
    const logData = {
      event,
      ...data,
      timestamp: new Date().toISOString()
    };

    logger.info(logData, 'Business Event');
  }
};

// Export logger and utilities
module.exports = {
  logger: enhancedLogger,
  logLevel: 'info',
  
  // Middleware for request logging
  requestLogger: (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const responseTime = Date.now() - start;
      enhancedLogger.apiRequest(req, res, responseTime);
    });
    
    next();
  },

  // Error logging middleware
  errorLogger: (err, req, res, next) => {
    enhancedLogger.error({
      error: err.message,
      stack: err.stack,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    }, 'Unhandled Error');
    
    next(err);
  },

  // Graceful shutdown logging
  shutdown: (signal) => {
    enhancedLogger.info({
      signal,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    }, 'Server shutting down gracefully');
  }
};