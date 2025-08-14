# Load Testing Infrastructure

This directory contains comprehensive load testing scripts for the Northeast India Social Forum API.

## Overview

The load testing suite measures system performance under realistic traffic patterns:

- **GET /api/posts?space=yap** (60% of traffic) - Post listing
- **POST /api/posts** (15% of traffic) - Post creation
- **POST /api/posts/:id/react** (15% of traffic) - Reactions
- **POST /api/posts/:id/comments** (10% of traffic) - Comments

## Test Scenarios

### Load Test Stages

1. **Ramp up to 60 RPS** (5 minutes)
2. **Hold 60 RPS** (7 minutes)
3. **Ramp up to 120 RPS** (3 minutes)
4. **Hold 120 RPS** (7 minutes)
5. **Ramp up to 200 RPS** (3 minutes)
6. **Hold 200 RPS** (5 minutes)
7. **Ramp down** (2 minutes)

**Total Duration:** ~32 minutes

## Prerequisites

1. **Install k6**

   ```bash
   # macOS
   brew install k6

   # Linux
   sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Start the API server**

   ```bash
   cd ../backend
   npm start
   # Server should be running on http://localhost:8080
   ```

3. **Ensure MongoDB is running**

   ```bash
   # Local MongoDB
   mongod

   # Or verify Atlas connection in .env
   ```

## Running Load Tests

### Basic Load Test

```bash
cd load
k6 run load-test.js
```

### Load Test with Custom Configuration

```bash
# Custom base URL
k6 run --env BASE_URL=http://your-server:8080 load-test.js

# Custom duration
k6 run --env TEST_DURATION=15m load-test.js

# Save results to file
k6 run --out json=results.json load-test.js
```

### System Monitoring During Tests

Run this in a separate terminal to monitor system metrics:

```bash
k6 run monitor-system.js > system-metrics.log 2>&1 &
```

## Interpreting Results

### Key Metrics to Monitor

1. **Response Time Percentiles**

   - p50 < 200ms (median response time)
   - p95 < 500ms (95th percentile)
   - p99 < 1000ms (99th percentile)

2. **Error Rate**

   - http_req_failed < 1%
   - Custom error rate < 1%

3. **Throughput**
   - Requests per second achieved
   - Data transfer rates

### Sample Output

```
     ✓ GET posts status is 200
     ✓ GET posts response time < 500ms
     ✓ POST create status is 201
     ✓ POST reaction status is 204 or 200

     checks.........................: 98.5%  ✓ 15234 ✗ 234
     data_received..................: 45 MB  1.4 MB/s
     data_sent......................: 12 MB  385 kB/s
     http_req_duration..............: avg=156ms min=23ms med=134ms max=2.1s p(90)=267ms p(95)=389ms
     http_req_failed................: 0.8%   ✓ 123   ✗ 15111
     http_reqs......................: 15234  487.2/s
     iteration_duration.............: avg=1.2s min=1.0s med=1.1s max=3.2s p(90)=1.4s p(95)=1.7s
     iterations.....................: 15234  487.2/s
     vus............................: 120    min=0   max=200
     vus_max........................: 200
```

## System Resource Monitoring

### During Load Tests, Monitor:

1. **API Server Metrics**

   - CPU usage (`top`, `htop`)
   - Memory usage
   - Node.js heap size
   - Event loop lag

2. **Database Metrics**

   - MongoDB CPU/Memory usage
   - Connection pool utilization
   - Query performance
   - Index usage

3. **Network Metrics**
   - Request/response rates
   - Bandwidth utilization
   - Connection counts

### Monitoring Commands

```bash
# Monitor API server process
top -p $(pgrep -f "node.*server.js")

# Monitor MongoDB
mongostat --host localhost:27017

# Monitor system resources
iostat -x 1
vmstat 1

# Monitor network connections
netstat -an | grep :8080 | wc -l
```

## Capacity Analysis

### Calculating DAU from RPS

```
DAU = (Sustained RPS × 86,400 seconds/day) ÷ (Requests per DAU per day) ÷ Peak factor

Example:
- Sustained RPS: 120
- Requests/DAU/day: 100
- Peak factor: 8

DAU = (120 × 86,400) ÷ 100 ÷ 8 = 12,960 DAU
```

### Performance Thresholds

- **Green Zone:** p95 < 200ms, error rate < 0.5%
- **Yellow Zone:** p95 < 500ms, error rate < 1%
- **Red Zone:** p95 > 500ms, error rate > 1%

## Troubleshooting

### Common Issues

1. **High Error Rates**

   - Check rate limiting configuration
   - Verify database connections
   - Monitor memory usage

2. **Slow Response Times**

   - Check database query performance
   - Monitor CPU usage
   - Verify index usage

3. **Connection Errors**
   - Increase MongoDB connection pool
   - Check network limits
   - Verify firewall settings

### Debug Mode

```bash
# Enable verbose logging
k6 run --verbose load-test.js

# Run with fewer VUs for debugging
k6 run --vus 10 --duration 2m load-test.js
```

## Results Analysis

After running tests, analyze:

1. **Sustained RPS** - Maximum RPS with p95 < 500ms and errors < 1%
2. **Bottlenecks** - CPU, memory, database, or network limits
3. **Scaling Points** - Where performance degrades
4. **Resource Utilization** - Peak usage during tests

## Next Steps

Based on results:

1. **Optimize** bottlenecks identified
2. **Scale** infrastructure if needed
3. **Tune** database indexes and queries
4. **Configure** caching layers
5. **Set** production monitoring alerts

## Files

- `load-test.js` - Main load testing script
- `monitor-system.js` - System monitoring during tests
- `README.md` - This documentation
- `results/` - Test results and analysis (created after runs)
