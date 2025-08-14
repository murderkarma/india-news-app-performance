/**
 * System Monitoring Script for Load Testing
 * Monitors CPU, Memory, MongoDB metrics during load tests
 */

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  vus: 1,
  duration: '30m', // Run for duration of load test
  iterations: 1800, // Every second for 30 minutes
};

export default function() {
  // Get health metrics
  const healthRes = http.get(`${BASE_URL}/health`);
  
  if (healthRes.status === 200) {
    try {
      const health = JSON.parse(healthRes.body);
      
      // Log system metrics
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        status: health.status,
        system: {
          memory: health.system?.memory,
          uptime: health.system?.uptime
        },
        database: {
          status: health.services?.database?.status,
          responseTime: health.services?.database?.responseTime,
          stats: health.services?.database?.stats
        },
        posts: {
          status: health.services?.posts?.status,
          responseTime: health.services?.posts?.responseTime,
          posts: health.services?.posts?.posts
        },
        metrics: health.metrics
      }));
    } catch (e) {
      console.error('Failed to parse health response:', e);
    }
  }
  
  // Get analytics metrics
  const analyticsRes = http.get(`${BASE_URL}/api/analytics/metrics`);
  
  if (analyticsRes.status === 200) {
    try {
      const analytics = JSON.parse(analyticsRes.body);
      console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        type: 'analytics',
        metrics: analytics
      }));
    } catch (e) {
      console.error('Failed to parse analytics response:', e);
    }
  }
  
  // Sleep for 1 second
  sleep(1);
}