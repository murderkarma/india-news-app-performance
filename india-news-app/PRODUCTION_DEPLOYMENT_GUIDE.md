# Northeast India Social Forum - Production Deployment Guide

**Version:** v0.9.0-perf-ci  
**Status:** Ready for Production Deployment  
**Generated:** January 17, 2025

## 🎯 Deployment Overview

This guide provides step-by-step instructions for deploying the Northeast India Social Forum to production with validated CI/CD performance testing pipeline.

**Prerequisites Completed:**

- ✅ GitHub Actions CI/CD pipeline validated (Workflow #17 successful)
- ✅ Performance optimization complete (<4% error rate, <500ms p95)
- ✅ Authentication system optimized with Redis caching
- ✅ All external service bypasses implemented for CI
- ✅ Release v0.9.0-perf-ci tagged and ready

## 📋 Production Deployment Checklist

### Phase 1: Infrastructure Setup

#### 1. Provision Redis (Upstash) 🔴 CRITICAL

**Steps:**

1. Go to [Upstash Console](https://console.upstash.com/)
2. Create new Redis database:
   - **Name:** `neisf-production-cache`
   - **Region:** Choose closest to your server location
   - **Type:** Pay as you go (recommended for production)
3. Get credentials from database dashboard:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

**Expected Values:**

```bash
UPSTASH_REDIS_REST_URL=https://your-db-name.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

#### 2. Configure Production Environment Variables 🔴 CRITICAL

Create production `.env` file:

```bash
# Production Configuration
NODE_ENV=production
TEST_MODE=false

# Database
MONGODB_URI=mongodb+srv://your-atlas-connection-string

# Redis Cache (Upstash)
REDIS_URL=https://your-db-name.upstash.io
REDIS_TOKEN=your-upstash-token

# Security
JWT_SECRET=your-super-strong-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-super-strong-refresh-secret-min-32-chars

# Rate Limiting (Production Values)
RATE_LIMIT_READS_PER_MIN=3000
RATE_LIMIT_WRITES_PER_MIN=120
RATE_LIMIT_AUTH_PER_15MIN=60

# Server Configuration
PORT=8080
CORS_ORIGIN=https://your-frontend-domain.com

# External Services
POSTHOG_API_KEY=your-posthog-key
EXPO_ACCESS_TOKEN=your-expo-token
```

**🚨 CRITICAL SAFETY CHECKS:**

- ✅ `TEST_MODE=false` (MUST be false in production)
- ✅ `NODE_ENV=production`
- ✅ Strong JWT secrets (minimum 32 characters)
- ✅ Production rate limits enabled

#### 3. Set Production Rate Limits

**Recommended Production Values:**

```javascript
// High read capacity for social media app
RATE_LIMIT_READS_PER_MIN = 3000; // 50 RPS sustained
RATE_LIMIT_WRITES_PER_MIN = 120; // 2 RPS per user (reasonable for posts/comments)
RATE_LIMIT_AUTH_PER_15MIN = 60; // 4 auth attempts per minute
```

**Rate Limit Strategy:**

- **Reads:** High limit (3000/min) for feed browsing
- **Writes:** Moderate limit (60-120/min/user) to prevent spam
- **Auth:** Conservative limit (60/15min) for security

### Phase 2: Deployment

#### 4. Deploy Backend with PM2

**Installation:**

```bash
# Install PM2 globally if not already installed
npm install -g pm2

# Navigate to backend directory
cd india-news-app/backend
```

**Production Deployment:**

```bash
# Start with PM2 in production mode
pm2 start server.js --name neisf --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script (auto-restart on server reboot)
pm2 startup
```

**PM2 Configuration (Optional - ecosystem.config.js):**

```javascript
module.exports = {
  apps: [
    {
      name: "neisf",
      script: "server.js",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
        TEST_MODE: "false",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      error_file: "./logs/err.log",
      out_file: "./logs/out.log",
      log_file: "./logs/combined.log",
      time: true,
    },
  ],
};
```

### Phase 3: Validation

#### 5. Post-Deployment Smoke Check 🔴 CRITICAL

**Health Check:**

```bash
# Basic health check
curl https://your-domain.com/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-01-17T17:00:00.000Z",
  "uptime": 123.45,
  "version": "v0.9.0-perf-ci"
}
```

**API Functionality Test:**

```bash
# Test posts endpoint with authentication
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://your-domain.com/api/posts?space=yap&limit=20"

# Expected: <200ms warm, <500ms cold response
# Expected: Valid JSON response with posts array
```

**Cache Stats Check:**

```bash
# Verify Redis caching is working (requires auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     "https://your-domain.com/api/debug/cache-stats"

# Expected response:
{
  "jwt_cache": {
    "hit_rate": "90%+",
    "total_requests": 1000,
    "cache_hits": 900
  }
}
```

#### 6. Production Load Sanity Test 🔴 CRITICAL

**Run Production Load Test:**

```bash
# Navigate to load testing directory
cd india-news-app/load

# Run production smoke test (NOT in TEST_MODE)
TEST_MODE=false k6 run smoke-test.js

# Expected Results:
# ✅ Error Rate: <1% (stricter than CI's 4%)
# ✅ p95 Response Time: <500ms
# ✅ p99 Response Time: <1000ms
# ✅ All status codes within expected ranges
```

**Production vs CI Expectations:**

- **CI Environment:** <4% error budget (absorbs runner hiccups)
- **Production Environment:** <1% error target (real user experience)

### Phase 4: Monitoring & Alerts

#### 7. Configure Monitoring and Alerts 🔴 NON-NEGOTIABLE

**Critical Alerts to Configure:**

**Performance Alerts:**

```yaml
# Error Rate Alert
- Alert: HTTP Request Failure Rate > 1%
  Duration: 5 minutes
  Action: Immediate notification

# Response Time Alert
- Alert: p95 Response Time > 500ms
  Duration: 5 minutes
  Action: Immediate notification

# Cache Performance Alerts
- Alert: JWT Cache Hit Rate < 90%
  Duration: 10 minutes
  Action: Investigation required

- Alert: Feed Cache Hit Rate < 70%
  Duration: 10 minutes
  Action: Performance degradation warning
```

**Infrastructure Alerts:**

```yaml
# Database Connection Pool
- Alert: MongoDB Connection Pool > 80% for >5 minutes
  Action: Scale database or investigate connection leaks

# Memory Usage
- Alert: Node.js Memory Usage > 80%
  Action: Investigate memory leaks

# Redis Connectivity
- Alert: Redis Connection Failures
  Action: Check Upstash status and credentials
```

**Monitoring Endpoints:**

- **Health Check:** `GET /health` (public)
- **Cache Stats:** `GET /api/debug/cache-stats` (authenticated)
- **Performance Metrics:** Integrate with your APM solution

#### 8. Set Up Branch Protection Rules

**GitHub Repository Settings:**

1. Go to Settings → Branches
2. Add rule for `main` branch:
   - ✅ Require status checks to pass before merging
   - ✅ Require "K6 Smoke Test (30s/50VU)" to pass
   - ✅ Restrict deletions
   - ✅ Block force pushes
   - ✅ Require pull request reviews

**Branch Protection Benefits:**

- All code changes must pass performance tests
- Prevents performance regressions
- Maintains code quality standards

### Phase 5: Safety Verification

#### 9. Verify Safety Switches 🔴 CRITICAL

**Production Safety Checklist:**

**Environment Variables:**

```bash
# Verify these are set correctly in production
echo $TEST_MODE          # Must be "false"
echo $NODE_ENV           # Must be "production"
echo $REDIS_URL          # Must be Upstash URL
echo $JWT_SECRET         # Must be strong secret
```

**CI vs Production Behavior:**

- ✅ **CI Environment:** TEST_MODE=true, bypasses external services
- ✅ **Production Environment:** TEST_MODE=false, uses real Redis/services
- ✅ **CI Bypass:** Only works in GitHub Actions, not in production

**Verification Commands:**

```bash
# Check that CI bypass is NOT active in production
curl https://your-domain.com/api/debug/test-mode-status

# Expected response:
{
  "test_mode": false,
  "environment": "production",
  "redis_connected": true,
  "external_services_active": true
}
```

## 🚨 Critical Success Criteria

**Before Going Live:**

- [ ] Redis (Upstash) provisioned and connected
- [ ] TEST_MODE=false in production environment
- [ ] Health check returns 200 OK
- [ ] Cache hit rate >90% for JWT, >70% for feeds
- [ ] Production load test: <1% errors, <500ms p95
- [ ] All monitoring alerts configured
- [ ] Branch protection rules active

**Performance Targets (Production):**

- **Error Rate:** <1% (stricter than CI's 4%)
- **Response Time:** p95 <500ms, p99 <1000ms
- **Cache Performance:** JWT >90%, Feed >70%
- **Availability:** >99.5% uptime

## 🔧 Troubleshooting

**Common Issues:**

**High Error Rate (>1%):**

1. Check Redis connectivity to Upstash
2. Verify MongoDB Atlas connection
3. Check rate limiting configuration
4. Review server logs: `pm2 logs neisf`

**Slow Response Times (>500ms p95):**

1. Check cache hit rates via `/api/debug/cache-stats`
2. Monitor database connection pool usage
3. Verify Redis latency to Upstash
4. Check for memory leaks: `pm2 monit`

**Authentication Issues:**

1. Verify JWT_SECRET is set correctly
2. Check Redis connection for JWT caching
3. Ensure TEST_MODE=false in production
4. Review auth middleware logs

**Cache Performance Issues:**

1. Monitor Redis memory usage in Upstash console
2. Check cache TTL settings
3. Verify cache key patterns
4. Review cache warming effectiveness

## 📊 Monitoring Dashboard

**Key Metrics to Track:**

- HTTP request rate and error percentage
- Response time percentiles (p50, p95, p99)
- Cache hit rates (JWT, feed, general)
- Database connection pool utilization
- Memory and CPU usage
- Redis connection status

**Recommended Tools:**

- **APM:** New Relic, DataDog, or similar
- **Uptime Monitoring:** Pingdom, UptimeRobot
- **Log Aggregation:** LogDNA, Papertrail
- **Custom Dashboards:** Grafana + Prometheus

## 🎉 Success Validation

**Deployment Complete When:**

1. ✅ All health checks pass
2. ✅ Production load test meets <1% error, <500ms p95 targets
3. ✅ Cache hit rates >90% JWT, >70% feed
4. ✅ Monitoring alerts configured and tested
5. ✅ Branch protection enforcing performance tests
6. ✅ Safety switches verified (TEST_MODE=false)

**Next Steps After Deployment:**

1. Monitor performance metrics for first 24 hours
2. Gradually increase traffic load
3. Fine-tune rate limits based on actual usage
4. Plan horizontal scaling when approaching capacity limits

---

**Deployment Status:** Ready for Production  
**Performance Validated:** ✅ GitHub Actions Workflow #17 Passed  
**Release Version:** v0.9.0-perf-ci  
**Contact:** Development Team
