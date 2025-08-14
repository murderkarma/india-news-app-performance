/**
 * Minimal Server for Load Testing
 * Simplified version without complex logging for performance testing
 */

const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
require('dotenv').config({ path: __dirname + '/.env' });

console.log('🚀 Starting Load Test Server...');
console.log('MONGODB_URI:', process.env.MONGODB_URI);

// Import routes
const { router: authRoutes } = require('./authRoutes');
const postRoutes = require('./routes/postRoutes-loadtest');

const app = express();
const PORT = 8080;

// Basic security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(mongoSanitize());
app.use(xss());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
});
app.use(['/api/posts'], writeLimiter);

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:19006', 'http://localhost:8081'],
  credentials: true,
}));

// Middleware
app.use(express.json());

// Simple request logging for load testing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Load Test API is running...',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Health check
app.get('/health', async (req, res) => {
  try {
    // Simple MongoDB ping
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'healthy',
      database: dbStatus,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);

// Simple error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Environment validation
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing');
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is missing');

// Database connection
mongoose.set('autoIndex', false); // Disable for performance

mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: parseInt(process.env.DB_POOL || '20', 10),
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Load Test Server running on http://localhost:${PORT}`);
      console.log(`🌐 Network access: http://192.168.1.196:${PORT}`);
      console.log('📋 Available endpoints:');
      console.log('   GET  /                     - Server status');
      console.log('   GET  /health               - Health check');
      console.log('   GET  /api/posts?space=yap  - Get posts');
      console.log('   POST /api/posts            - Create post');
      console.log('   POST /api/posts/:id/react  - React to post');
      console.log('   POST /api/posts/:id/comments - Add comment');
      console.log('🔥 Ready for load testing!');
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully...`);
  
  mongoose.disconnect().then(() => {
    console.log('Database connection closed');
    process.exit(0);
  });
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  gracefulShutdown('unhandledRejection');
});