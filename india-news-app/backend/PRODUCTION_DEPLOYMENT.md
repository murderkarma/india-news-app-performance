# Production Deployment Guide

## Northeast India Social Forum & News App

This guide covers the complete production deployment setup with monitoring, logging, and analytics.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 5.0+
- PM2 (for process management)
- Nginx (for reverse proxy)
- SSL certificate (Let's Encrypt recommended)

### Environment Setup

1. **Clone and Install**

```bash
git clone <your-repo>
cd india-news-app/backend
npm install
```

2. **Environment Configuration**

```bash
cp .env.example .env
# Edit .env with production values
```

Required environment variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/northeast-forum-prod

# Authentication
JWT_SECRET=your-super-secure-jwt-secret-here

# Server
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# CORS
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Analytics (Optional)
POSTHOG_API_KEY=your-posthog-key
MIXPANEL_TOKEN=your-mixpanel-token

# Monitoring
UPTIME_ROBOT_API_KEY=your-uptimerobot-key
BETTERSTACK_TOKEN=your-betterstack-token

# Features
AUTO_START_SCHEDULER=true
APP_VERSION=1.0.0
```

## 📊 Monitoring Setup

### 1. Server Monitoring with PM2

**Start the application:**

```bash
# Production start
pm2 start ecosystem.config.js --env production

# View logs
pm2 logs northeast-forum-api

# Monitor processes
pm2 monit

# Save PM2 configuration
pm2 save
pm2 startup
```

**PM2 Features Enabled:**

- ✅ Auto-restart on crash
- ✅ Memory limit monitoring (512MB)
- ✅ Log rotation
- ✅ Health checks
- ✅ Graceful shutdown

### 2. Health Endpoint

The comprehensive health endpoint is available at:

```
GET /health
```

**Response includes:**

- Database connectivity and performance
- System metrics (memory, uptime, CPU)
- Posts system status
- Authentication system status
- Error rates and request counts

### 3. External Monitoring Integration

#### UptimeRobot Setup

1. Create account at [uptimerobot.com](https://uptimerobot.com)
2. Add HTTP(s) monitor for `https://yourdomain.com/health`
3. Set check interval to 60 seconds
4. Configure alerts (email, SMS, Slack)

#### BetterStack Setup

1. Create account at [betterstack.com](https://betterstack.com)
2. Add uptime monitor for your health endpoint
3. Configure incident management
4. Set up status page

## 📝 Logging System

### Enhanced Pino Logging

- **Development**: Pretty-printed console output
- **Production**: Structured JSON logs with rotation
- **Log Levels**: error, warn, info, debug
- **Security**: Automatic redaction of sensitive data

### Log Files Location

```
backend/logs/
├── app.log          # Application logs
├── error.log        # Error logs only
├── debug.log        # Debug logs (if enabled)
└── logrotate.conf   # Rotation configuration
```

### Log Rotation Setup

```bash
# Copy logrotate configuration
sudo cp backend/logs/logrotate.conf /etc/logrotate.d/northeast-forum

# Test rotation
sudo logrotate -d /etc/logrotate.d/northeast-forum
```

## 📈 Analytics Integration

### Backend Analytics

- **Request tracking**: All API calls logged with performance metrics
- **User activity**: Daily active users, registrations, logins
- **Business metrics**: Posts created, reactions, comments by space
- **Performance monitoring**: Response times, slow queries, error rates

### Frontend Analytics (PostHog)

1. **Setup PostHog account**
2. **Add environment variables:**

```env
EXPO_PUBLIC_POSTHOG_KEY=phc_your_key_here
EXPO_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

3. **Events tracked:**
   - User interactions (reactions, comments, posts)
   - Navigation and page views
   - Performance metrics
   - Error tracking
   - Feature flag usage

## 🔧 System Configuration

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/private.key;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    # API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check (bypass auth)
    location /health {
        proxy_pass http://localhost:8080;
        access_log off;
    }

    # Static files
    location /avatars/ {
        proxy_pass http://localhost:8080;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }
}
```

### MongoDB Configuration

```javascript
// Recommended production settings
{
  "storage": {
    "wiredTiger": {
      "engineConfig": {
        "cacheSizeGB": 2
      }
    }
  },
  "systemLog": {
    "destination": "file",
    "path": "/var/log/mongodb/mongod.log",
    "logRotate": "reopen"
  },
  "net": {
    "bindIp": "127.0.0.1"
  },
  "security": {
    "authorization": "enabled"
  }
}
```

## 🔒 Security Checklist

- ✅ Helmet.js security headers
- ✅ Rate limiting (auth: 60/15min, writes: 30/min)
- ✅ Input sanitization (XSS, NoSQL injection)
- ✅ JWT authentication
- ✅ CORS configuration
- ✅ Environment variable validation
- ✅ Sensitive data redaction in logs
- ✅ HTTPS enforcement
- ✅ MongoDB authentication

## 📊 Performance Optimization

### Database Indexes

```javascript
// Recommended indexes for production
db.posts.createIndex({ space: 1, isActive: 1, createdAt: -1 });
db.posts.createIndex({ "author.id": 1 });
db.posts.createIndex({ space: 1, isPinned: -1, createdAt: -1 });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
```

### Caching Strategy

- **Application-level**: 60-second memory cache for posts
- **Database-level**: MongoDB query result caching
- **CDN-level**: Static assets and avatars
- **Browser-level**: API response caching headers

## 🚨 Monitoring Alerts

### Critical Alerts

- Server down (health check fails)
- Database connection lost
- Memory usage > 90%
- Error rate > 5%
- Response time > 2 seconds

### Warning Alerts

- Memory usage > 70%
- Disk space < 20%
- Error rate > 1%
- Slow queries > 500ms

## 📱 Mobile App Deployment

### Expo Build Configuration

```json
{
  "expo": {
    "name": "Northeast Forum",
    "slug": "northeast-forum",
    "version": "1.0.0",
    "extra": {
      "apiUrl": "https://yourdomain.com/api",
      "posthogKey": "phc_your_key_here"
    }
  }
}
```

## 🔄 Deployment Workflow

### Automated Deployment

```bash
# Using PM2 ecosystem
pm2 deploy production setup    # First time setup
pm2 deploy production          # Deploy updates
pm2 deploy production revert   # Rollback if needed
```

### Manual Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm install --production

# 3. Run database migrations (if any)
npm run migrate

# 4. Restart application
pm2 reload ecosystem.config.js --env production

# 5. Verify deployment
curl https://yourdomain.com/health
```

## 📋 Maintenance Tasks

### Daily

- Monitor error rates and performance metrics
- Check disk space and memory usage
- Review critical alerts

### Weekly

- Analyze user activity and engagement metrics
- Review slow query logs
- Update security patches

### Monthly

- Database maintenance and optimization
- Log cleanup and archival
- Performance review and optimization
- Security audit

## 🆘 Troubleshooting

### Common Issues

**High Memory Usage:**

```bash
# Check memory usage
pm2 show northeast-forum-api
# Restart if needed
pm2 restart northeast-forum-api
```

**Database Connection Issues:**

```bash
# Check MongoDB status
sudo systemctl status mongod
# Check connection
mongo --eval "db.adminCommand('ismaster')"
```

**High Error Rates:**

```bash
# Check error logs
pm2 logs northeast-forum-api --err
# Check specific errors
tail -f backend/logs/error.log
```

## 📞 Support

For production issues:

1. Check health endpoint: `/health`
2. Review error logs: `pm2 logs --err`
3. Monitor system metrics: `pm2 monit`
4. Check external monitoring dashboards

---

**🎉 Your Northeast India Social Forum is now production-ready with comprehensive monitoring, logging, and analytics!**
