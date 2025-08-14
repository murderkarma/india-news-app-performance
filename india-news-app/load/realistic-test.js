/**
 * K6 Realistic Mode Test for Northeast India Social Forum API
 * Tests with TEST_MODE=false (rate limits ON) and realistic write mix
 * Validates 429 handling and p95 performance under real constraints
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const requestCount = new Counter('requests');
const rateLimitHits = new Counter('rate_limit_429s');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Test data
const testUsers = [
  { username: 'realistictest1', password: 'test123', gender: 'female', state: 'Assam' },
  { username: 'realistictest2', password: 'test123', gender: 'male', state: 'Meghalaya' },
  { username: 'realistictest3', password: 'test123', gender: 'female', state: 'Manipur' }
];

const postBodies = [
  'Realistic test post to validate rate limiting behavior.',
  'Testing system performance with rate limits enabled.',
  'Validating 429 responses and p95 performance under constraints.'
];

const reactionTypes = ['heart', 'laugh', 'fire'];
const spaces = ['yap', 'tea', 'brospace'];

// Realistic test configuration: 30 VUs for 60 seconds
export const options = {
  vus: 30,
  duration: '60s',
  
  thresholds: {
    http_req_duration: ['p(95)<1000'], // More lenient for realistic mode
    http_req_failed: ['rate<0.05'],    // Allow up to 5% failures (including 429s)
    errors: ['rate<0.05'],
    response_time: ['p(95)<1000'],
    rate_limit_429s: ['count<100']     // Expect some 429s but not excessive
  },
  
  // Test metadata
  tags: {
    testType: 'realistic',
    system: 'northeast-forum-api',
    rateLimits: 'enabled',
    testMode: 'false'
  }
};

// Global variables for session management
let postIds = [];

export function setup() {
  console.log('🚀 Starting realistic mode test setup...');
  console.log('⚠️  Rate limits are ENABLED - expect some 429 responses');
  
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
    'Authorization': `Bearer ${authToken}`
    // NOTE: No 'x-load-test' header - rate limits are ACTIVE
  };
  
  // Realistic traffic mix: 80% reads, 15% writes, 5% reactions
  const scenario = Math.random();
  
  if (scenario < 0.8) {
    // 80% - GET posts (most common operation)
    testGetPosts(headers);
  } else if (scenario < 0.95) {
    // 15% - Create post (realistic write percentage)
    testCreatePost(headers);
  } else {
    // 5% - Add reaction
    testAddReaction(headers);
  }
  
  // Track metrics
  const duration = Date.now() - startTime;
  responseTime.add(duration);
  requestCount.add(1);
  
  // Realistic user behavior - longer pauses
  sleep(Math.random() * 2 + 1); // 1-3 seconds between requests
}

function testGetPosts(headers) {
  const space = spaces[Math.floor(Math.random() * spaces.length)];
  const sort = ['hot', 'new'][Math.floor(Math.random() * 2)];
  const limit = [10, 20][Math.floor(Math.random() * 2)];
  
  const url = `${BASE_URL}/api/posts?space=${space}&sort=${sort}&limit=${limit}`;
  const response = http.get(url, { headers });
  
  // Check for rate limiting
  if (response.status === 429) {
    rateLimitHits.add(1);
    console.log(`⚠️  Rate limited on GET ${space} (429)`);
  }
  
  const success = check(response, {
    'GET posts status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'GET posts response time < 1000ms': (r) => r.timings.duration < 1000,
    'GET posts has posts array (if 200)': (r) => {
      if (r.status !== 200) return true; // Skip check for non-200
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body.posts);
      } catch {
        return false;
      }
    }
  });
  
  if (!success && response.status !== 429) {
    errorRate.add(1);
  }
  
  // Store post IDs for reactions (only if successful)
  if (response.status === 200) {
    try {
      const body = JSON.parse(response.body);
      if (body.posts && body.posts.length > 0) {
        postIds.push(...body.posts.map(p => p.id).slice(0, 2));
        if (postIds.length > 20) {
          postIds = postIds.slice(-20);
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
  const title = `Realistic Test Post ${Date.now()}`;
  
  const payload = {
    space,
    title,
    body: `${body} (Generated at ${new Date().toISOString()})`,
    topic: space === 'yap' ? 'random' : 'discussion'
  };
  
  const response = http.post(`${BASE_URL}/api/posts`, JSON.stringify(payload), { headers });
  
  // Check for rate limiting
  if (response.status === 429) {
    rateLimitHits.add(1);
    console.log(`⚠️  Rate limited on POST ${space} (429)`);
  }
  
  const success = check(response, {
    'POST create status is 201 or 429': (r) => r.status === 201 || r.status === 429,
    'POST create response time < 2000ms': (r) => r.timings.duration < 2000,
    'POST create returns post ID (if 201)': (r) => {
      if (r.status !== 201) return true; // Skip check for non-201
      try {
        const body = JSON.parse(r.body);
        return body.post && body.post.id;
      } catch {
        return false;
      }
    }
  });
  
  if (!success && response.status !== 429) {
    errorRate.add(1);
  }
  
  // Store created post ID (only if successful)
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
  
  // Check for rate limiting
  if (response.status === 429) {
    rateLimitHits.add(1);
    console.log(`⚠️  Rate limited on REACTION ${postId} (429)`);
  }
  
  const success = check(response, {
    'POST reaction status is 204, 200, or 429': (r) => r.status === 204 || r.status === 200 || r.status === 429,
    'POST reaction response time < 1000ms': (r) => r.timings.duration < 1000
  });
  
  if (!success && response.status !== 429) {
    errorRate.add(1);
  }
}

export function teardown(data) {
  console.log('🧹 Realistic mode test teardown...');
  console.log('📊 Check results for 429 rate limit responses - some are expected');
  console.log('✅ Realistic mode test completed');
}

// Export for external monitoring
export { errorRate, responseTime, requestCount, rateLimitHits };