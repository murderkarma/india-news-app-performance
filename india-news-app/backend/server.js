console.log("server.js loaded from:", __filename);

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const pino = require('pino');
const pinoHttp = require('pino-http');
const { limitWrites, limitReads } = require('./middleware/upstashRateLimit');
require('dotenv').config({ path: __dirname + '/.env' });
console.log('MONGODB_URI:', process.env.MONGODB_URI);

console.log("About to require newsRoutes.js from:", __dirname + '/newsRoutes');
const newsRoutes = require('./newsRoutes');

// Import auth routes
const { router: authRoutes } = require('./authRoutes');

// Import forum routes
const forumRoutes = require('./forumRoutes');

// Import Tea/Island routes
const teaIslandRoutes = require('./teaIslandRoutes');

// Import comment routes
const commentRoutes = require('./commentRoutes');

// Import notification routes
const notificationRoutes = require('./notificationRoutes');

// Import moderation routes
const moderationRoutes = require('./moderationRoutes');

// Import user profile routes
const userProfileRoutes = require('./userProfileRoutes');

// Import YAP routes (legacy - will be deprecated)
const yapRoutes = require('./yapRoutes');

// Import unified post routes (new architecture)
const postRoutes = require('./routes/postRoutes');

// Import debug routes
const debugRoutes = require('./routes/debugRoutes');

// Import auth middleware for health endpoint bypass
const auth = require('./middleware/auth');

// Import the automated scraper scheduler
const ScraperScheduler = require('./services/scraperScheduler');

const app = express();
const PORT = 8080;

// Initialize scheduler
let scraperScheduler = null;

// Use simple console logger to avoid pino transport conflicts
const logger = {
  info: (data, msg) => console.log(`[INFO] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  error: (data, msg) => console.error(`[ERROR] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  warn: (data, msg) => console.warn(`[WARN] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  debug: (data, msg) => console.log(`[DEBUG] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
};

// Simple request logger middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${res.statusCode} (${responseTime}ms)`);
  });
  next();
};

// Simple error logger middleware
const errorLogger = (err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`, {
    method: req.method,
    url: req.originalUrl,
    stack: err.stack
  });
  next(err);
};
const healthService = require('./services/healthService');
const analyticsService = require('./services/analyticsService');

// Use enhanced request logging
app.use(requestLogger);

// Helmet security headers (allow cross-origin images if you serve avatars)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Sanitize payloads
app.use(mongoSanitize());
app.use(xss());

// Clean Upstash rate limiting with TEST_MODE bypass
console.log('✅ Using clean Upstash rate limiting with TEST_MODE bypass');
console.log(`🧪 TEST_MODE: ${process.env.TEST_MODE === 'true' ? 'ENABLED' : 'DISABLED'}`);

// Enhanced CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:19006', 'http://localhost:8081'],
  credentials: true,
}));

// Middleware
app.use(express.json());

// Serve static files for avatars
app.use('/avatars', express.static(__dirname + '/public/avatars'));

// Optimized request logger - only log in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`🔥 ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Test route
app.get('/', (req, res) => {
  res.send('API is running...');
});

// API Routes
app.use('/api/news', newsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/forum', forumRoutes);
app.use('/api/general-forum', teaIslandRoutes); // Reuse teaIslandRoutes for general forums
app.use('/api/tea-island', teaIslandRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/users', userProfileRoutes);

// Unified Post Routes (new architecture)
app.use('/api/posts', postRoutes);

// Debug routes for performance monitoring
app.use('/api/debug', debugRoutes);

// Legacy routes (backward compatibility - will be deprecated)
app.use('/api/yap', yapRoutes);

// Backward compatibility proxies for Tea/Brospace
app.use('/api/tea', (req, res, next) => {
  console.log('⚠️  DEPRECATED: /api/tea route used. Please migrate to /api/posts?space=tea');
  
  // Proxy GET requests to unified posts API
  if (req.method === 'GET') {
    req.query.space = 'tea';
    return postRoutes(req, res, next);
  }
  
  // Proxy POST requests to unified posts API
  if (req.method === 'POST') {
    req.body.space = 'tea';
    return postRoutes(req, res, next);
  }
  
  // For other methods, fall back to original routes
  return teaIslandRoutes(req, res, next);
});

app.use('/api/brospace', (req, res, next) => {
  console.log('⚠️  DEPRECATED: /api/brospace route used. Please migrate to /api/posts?space=brospace');
  
  // Proxy GET requests to unified posts API
  if (req.method === 'GET') {
    req.query.space = 'brospace';
    return postRoutes(req, res, next);
  }
  
  // Proxy POST requests to unified posts API
  if (req.method === 'POST') {
    req.body.space = 'brospace';
    return postRoutes(req, res, next);
  }
  
  // For other methods, fall back to original routes
  return teaIslandRoutes(req, res, next);
});

// Enhanced health check endpoint with auth bypass and comprehensive monitoring
app.get('/health', auth.bypass, async (req, res) => {
  try {
    const healthData = await healthService.performHealthCheck();
    
    if (healthData.status === 'healthy') {
      res.json(healthData);
    } else {
      res.status(503).json(healthData);
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Health check endpoint failed');
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Analytics and metrics endpoints
app.get('/api/analytics/metrics', (req, res) => {
  try {
    const metrics = analyticsService.getMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error({ error: error.message }, 'Analytics metrics endpoint failed');
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

app.get('/api/analytics/report', (req, res) => {
  try {
    const report = analyticsService.generateReport();
    res.json(report);
  } catch (error) {
    logger.error({ error: error.message }, 'Analytics report endpoint failed');
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Health check for specific services
app.get('/health/quick', (req, res) => {
  const lastCheck = healthService.getLastHealthCheck();
  if (lastCheck && (Date.now() - new Date(lastCheck.timestamp).getTime()) < 60000) {
    // Return cached result if less than 1 minute old
    res.json(lastCheck);
  } else {
    res.json({
      status: 'unknown',
      message: 'No recent health check available',
      timestamp: new Date().toISOString()
    });
  }
});

// Scheduler management routes
app.get('/api/scheduler/status', (req, res) => {
  if (!scraperScheduler) {
    return res.json({
      running: false,
      message: 'Scheduler not initialized'
    });
  }
  
  res.json({
    running: true,
    stats: scraperScheduler.getStats()
  });
});

app.post('/api/scheduler/start', (req, res) => {
  if (!scraperScheduler) {
    scraperScheduler = new ScraperScheduler();
  }
  
  scraperScheduler.start();
  res.json({
    success: true,
    message: 'Scheduler started successfully'
  });
});

app.post('/api/scheduler/stop', (req, res) => {
  if (scraperScheduler) {
    scraperScheduler.stop();
    res.json({
      success: true,
      message: 'Scheduler stopped successfully'
    });
  } else {
    res.json({
      success: false,
      message: 'Scheduler not running'
    });
  }
});

app.post('/api/scheduler/run-manual', async (req, res) => {
  if (!scraperScheduler) {
    scraperScheduler = new ScraperScheduler();
  }
  
  try {
    // Run manual cycle in background
    scraperScheduler.runManualCycle().catch(err => {
      console.error('Manual cycle failed:', err);
    });
    
    res.json({
      success: true,
      message: 'Manual scraping cycle started in background'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to start manual cycle',
      error: error.message
    });
  }
});

// Environment validation
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');

// Analytics middleware for request tracking
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    
    // Track request in analytics
    analyticsService.trackRequest(req, res, responseTime);
    
    // Track in health service
    healthService.incrementRequests();
    if (res.statusCode >= 400) {
      healthService.incrementErrors();
    }
  });
  
  next();
});

// Error handling middleware (must be after all routes)
const { notFound, errorHandler } = require('./middleware/errorHandler');
app.use(notFound);
app.use(errorLogger); // Enhanced error logging
app.use(errorHandler);

// Configure database connection with enhanced pooling for high concurrency
mongoose.set('autoIndex', process.env.NODE_ENV !== 'production' ? true : false);

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Enhanced connection pooling for auth bottleneck fix
    maxPoolSize: 50,           // Raised from 20 to handle 200+ concurrent users
    minPoolSize: 5,            // Maintain minimum connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 20000,    // Reduced from 45000 for faster failover
    heartbeatFrequencyMS: 8000, // More frequent health checks
    // Connection retry logic
    maxIdleTimeMS: 30000,
    waitQueueTimeoutMS: 5000,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Auto-start scheduler if enabled in environment
    if (process.env.AUTO_START_SCHEDULER === 'true') {
      console.log('🤖 Auto-starting scraper scheduler...');
      scraperScheduler = new ScraperScheduler();
      scraperScheduler.start();
    }
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🌐 Network access: http://192.168.1.196:${PORT}`);
      console.log('🏗️  Architecture: Unified Post System v2.0');
      console.log('📋 API Endpoints:');
      console.log('   GET  /api/posts?space=yap      - Unified YAP posts');
      console.log('   GET  /api/posts?space=tea      - Unified Tea posts');
      console.log('   GET  /api/posts?space=brospace - Unified Brospace posts');
      console.log('   GET  /api/posts?space=local    - Unified Local posts');
      console.log('   POST /api/posts                - Create post in any space');
      console.log('   GET  /health                   - Enhanced health check');
      console.log('📋 Scheduler endpoints:');
      console.log('   GET  /api/scheduler/status     - Check scheduler status');
      console.log('   POST /api/scheduler/start      - Start automated scraping');
      console.log('   POST /api/scheduler/stop       - Stop automated scraping');
      console.log('   POST /api/scheduler/run-manual - Run manual cycle');
      console.log('⚠️  Legacy routes (/api/yap, /api/tea, /api/brospace) are deprecated');
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });

// Graceful shutdown with enhanced logging
const gracefulShutdown = (signal) => {
  logger.info({ signal }, '🛑 Shutting down gracefully...');
  
  if (scraperScheduler) {
    scraperScheduler.stop();
  }
  
  // Close database connection
  mongoose.disconnect().then(() => {
    logger.info('Database connection closed');
  });
  
  // Log final analytics
  const finalMetrics = analyticsService.getMetrics();
  logger.info({ metrics: finalMetrics }, 'Final server metrics');
  
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught Exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  gracefulShutdown('unhandledRejection');
});