/**
 * K6 Smoke Test for Northeast India Social Forum API
 * Quick 30-second test with 50 virtual users
 * Used for PR performance validation
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestCount = new Counter('requests');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test data
const testUsers = [
  { username: 'loadtest1', password: 'test123', gender: 'female', state: 'Assam' },
  { username: 'loadtest2', password: 'test123', gender: 'male', state: 'Meghalaya' },
  { username: 'loadtest3', password: 'test123', gender: 'female', state: 'Manipur' }
];

const postBodies = [
  'Smoke test post for performance validation.',
  'Testing API response times under light load.',
  'Quick performance check for PR validation.'
];

const reactionTypes = ['heart', 'laugh', 'fire'];
const spaces = ['yap', 'tea', 'brospace'];

// Smoke test configuration: 50 VUs for 30 seconds
export const options = {
  vus: 50,
  duration: '30s',
  
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% errors
    errors: ['rate<0.01'],
    response_time: ['p(95)<500']
  },
  
  // Test metadata
  tags: {
    testType: 'smoke',
    system: 'northeast-forum-api',
    duration: '30s',
    vus: '50'
  }
};

// Global variables for session management
let postIds = [];

export function setup() {
  console.log('🚀 Starting smoke test setup...');
  
  // Create test users and get auth tokens
  const tokens = {};
  
  for (const user of testUsers) {
    // Try to register user (may fail if already exists)
    const registerPayload = {
      username: user.username,
      password: user.password,
      gender: user.gender,
      state: user.state
    };
    
    const registerRes = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify(registerPayload), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    // Login to get token
    const loginPayload = {
      username: user.username,
      password: user.password
    };
    
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify(loginPayload), {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (loginRes.status === 200) {
      const loginData = JSON.parse(loginRes.body);
      tokens[user.username] = loginData.token;
      console.log(`✅ Auth token obtained for ${user.username}`);
    } else {
      console.error(`❌ Failed to get auth token for ${user.username}: ${loginRes.status}`);
    }
  }
  
  console.log(`🔑 Setup complete. Got ${Object.keys(tokens).length} auth tokens.`);
  return { tokens };
}

export default function(data) {
  const startTime = Date.now();
  
  // Select random user and auth token
  const usernames = Object.keys(data.tokens);
  const randomUser = usernames[Math.floor(Math.random() * usernames.length)];
  const authToken = data.tokens[randomUser];
  
  if (!authToken) {
    console.error(`No auth token for user ${randomUser}`);
    return;
  }
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
    'x-load-test': '1'  // Bypass rate limiting during load tests
  };
  
  // Test scenario weights (realistic usage patterns for smoke test)
  const scenario = Math.random();
  
  if (scenario < 0.7) {
    // 70% - GET posts (most common operation)
    testGetPosts(headers);
  } else if (scenario < 0.85) {
    // 15% - Create post
    testCreatePost(headers);
  } else {
    // 15% - Add reaction
    testAddReaction(headers);
  }
  
  // Track metrics
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  requestCount.add(1);
  
  // Small delay to simulate user behavior
  sleep(Math.random() * 0.3 + 0.1); // 0.1-0.4 seconds
}

function testGetPosts(headers) {
  const space = spaces[Math.floor(Math.random() * spaces.length)];
  const sort = ['hot', 'new'][Math.floor(Math.random() * 2)];
  const limit = [10, 20][Math.floor(Math.random() * 2)];
  
  const url = `${BASE_URL}/api/posts?space=${space}&sort=${sort}&limit=${limit}`;
  const response = http.get(url, { headers });
  
  const success = check(response, {
    'GET posts status is 200': (r) => r.status === 200,
    'GET posts response time < 500ms': (r) => r.timings.duration < 500,
    'GET posts has posts array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.posts);
      } catch {
        return false;
      }
    }
  });
  
  if (!success) {
    errorRate.add(1);
  }
  
  // Store post IDs for reactions
  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      if (body.posts && body.posts.length > 0) {
        postIds.push(...body.posts.map(p => p.id).slice(0, 2)); // Store up to 2 IDs
        if (postIds.length > 20) {
          postIds = postIds.slice(-20); // Keep only last 20 IDs
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
}

function testCreatePost(headers) {
  const space = spaces[Math.floor(Math.random() * spaces.length)];
  const body = postBodies[Math.floor(Math.random() * postBodies.length)];
  const title = `Smoke Test Post ${Date.now()}`;
  
  const payload = {
    space,
    title,
    body: `${body} (Generated at ${new Date().toISOString()})`,
    topic: space === 'yap' ? 'random' : 'discussion'
  };
  
  const response = http.post(`${BASE_URL}/api/posts`, JSON.stringify(payload), { headers });
  
  const success = check(response, {
    'POST create status is 201': (r) => r.status === 201,
    'POST create response time < 1000ms': (r) => r.timings.duration < 1000,
    'POST create returns post ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.post && body.post.id;
      } catch {
        return false;
      }
    }
  });
  
  if (!success) {
    errorRate.add(1);
  }
  
  // Store created post ID
  if (response.status === 201) {
    try {
      const body = JSON.parse(response.body);
      if (body.post && body.post.id) {
        postIds.push(body.post.id);
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
}

function testAddReaction(headers) {
  if (postIds.length === 0) {
    // No posts available, skip
    return;
  }
  
  const postId = postIds[Math.floor(Math.random() * postIds.length)];
  const reactionType = reactionTypes[Math.floor(Math.random() * reactionTypes.length)];
  
  const payload = { type: reactionType };
  const response = http.post(`${BASE_URL}/api/posts/${postId}/react`, JSON.stringify(payload), { headers });
  
  const success = check(response, {
    'POST reaction status is 204 or 200': (r) => r.status === 204 || r.status === 200,
    'POST reaction response time < 300ms': (r) => r.timings.duration < 300
  });
  
  if (!success) {
    errorRate.add(1);
  }
}

export function teardown(data) {
  console.log('🧹 Smoke test teardown...');
  console.log('✅ Smoke test completed');
}

// Export for external monitoring
export { errorRate, responseTime, requestCount };