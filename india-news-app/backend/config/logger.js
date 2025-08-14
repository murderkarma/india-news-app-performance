/**
 * Enhanced Production Logging Configuration
 * Extends Pino with log rotation, level filtering, and structured logging
 */

const pino = require('pino');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Log level configuration
const LOG_LEVELS = {
  development: 'debug',
  production: 'info',
  test: 'silent'
};

const logLevel = process.env.LOG_LEVEL || LOG_LEVELS[process.env.NODE_ENV] || 'info';

// Base logger configuration
const baseConfig = {
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label };
    },
    bindings: (bindings) => {
      return {
        pid: bindings.pid,
        hostname: bindings.hostname,
        node_version: process.version,
        app_version: process.env.APP_VERSION || '1.0.0'
      };
    }
  },
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'password',
      'token',
      'secret'
    ],
    censor: '[REDACTED]'
  }
};

// Development logger (pretty print to console)
const developmentLogger = pino({
  ...baseConfig,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname,node_version,app_version'
    }
  }
});

// Production logger with file rotation
const productionConfig = {
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'password',
      'token',
      'secret'
    ],
    censor: '[REDACTED]'
  }
};

const productionLogger = pino(productionConfig, pino.destination({
  dest: path.join(logsDir, 'app.log'),
  sync: false
}));

// Create logger instance
const logger = isDevelopment ? developmentLogger : productionLogger;

// Enhanced logging methods
const enhancedLogger = {
  ...logger,
  
  // API request logging
  apiRequest: (req, res, responseTime) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      responseTime: `${responseTime}ms`,
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length'),
      userId: req.user?.id,
      space: req.query?.space || req.body?.space
    };

    if (res.statusCode >= 400) {
      logger.error(logData, 'API Request Error');
    } else if (res.statusCode >= 300) {
      logger.warn(logData, 'API Request Redirect');
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

// Log rotation setup for production
if (isProduction) {
  // Setup log rotation using logrotate-style configuration
  const logRotateConfig = `
# Northeast India Social Forum - Log Rotation Configuration
# Place this in /etc/logrotate.d/northeast-forum

${logsDir}/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 node node
    postrotate
        # Send SIGUSR1 to reload logs (if using PM2)
        /usr/bin/pkill -USR1 -f "PM2"
    endscript
}
`;

  // Write logrotate configuration
  const logrotateConfigPath = path.join(logsDir, 'logrotate.conf');
  fs.writeFileSync(logrotateConfigPath, logRotateConfig);
  
  enhancedLogger.info({
    logsDir,
    logLevel,
    logrotateConfig: logrotateConfigPath
  }, 'Production logging initialized with rotation');
}

// Export logger and utilities
module.exports = {
  logger: enhancedLogger,
  logLevel,
  logsDir,
  
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