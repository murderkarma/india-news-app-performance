import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

/** ========= CONFIG ========= **/
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TEST_MODE_HEADER = { 'x-load-test': '1' }; // bypass rate-limit in TEST_MODE=true

// Spaces & enums must match backend EXACTLY (case-sensitive)
const SPACES = ['yap', 'tea', 'brospace', 'local'];
const VALID_STATES = [
  'Arunachal Pradesh','Assam','Manipur','Meghalaya','Mizoram','Nagaland','Sikkim','Tripura'
];
const TOPICS = ['discussion','question','hot','news', 'help', 'community', 'events']; // harmless set

// traffic mix for smoke: read heavy
const READ_RATIO = 0.85;     // GET /posts
const REACT_RATIO = 0.12;    // POST /:id/react
const WRITE_RATIO = 0.03;    // POST /posts

export const options = {
  vus: 50,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.02'],        // allow up to 2% failures (CI infra quirks)
    http_req_duration: ['p(95)<500'],      // p95 < 500ms
    http_reqs: ['count>300']               // ensure we generated enough traffic
  },
};

/** ========= METRICS ========= **/
const responseTime = new Trend('response_time');
const errors       = new Counter('errors');
const httpStatus   = new Counter('http_status');

/** ========= UTILS ========= **/
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...TEST_MODE_HEADER
  };
}

function validPostPayload() {
  // minimal valid payload that satisfies Zod + Mongoose
  return {
    space: pick(SPACES),
    title: 'k6 smoke',
    body: 'This is a k6 smoke test post. ✅',
    state: pick(VALID_STATES),     // ensure valid enum
    topic: pick(TOPICS),
    images: []                     // avoid file work in CI
  };
}

/** ========= LOGIN + CACHE WARM ========= **/
export function setup() {
  const users = ['loadtest1','loadtest2','loadtest3'];
  const tokens = [];

  for (const u of users) {
    // login first; if user doesn't exist, register then login
    let res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ username: u, password: 'Password123!' }), { 
      headers: { 'Content-Type': 'application/json', ...TEST_MODE_HEADER }
    });
    
    if (res.status === 401 || res.status === 404) {
      // register with valid state enum
      http.post(`${BASE_URL}/api/auth/register`,
        JSON.stringify({ username: u, password: 'Password123!', state: pick(VALID_STATES), gender: 'other' }),
        { headers: { 'Content-Type': 'application/json', ...TEST_MODE_HEADER } }
      );
      res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ username: u, password: 'Password123!' }), { 
        headers: { 'Content-Type': 'application/json', ...TEST_MODE_HEADER }
      });
    }
    
    check(res, { 'login ok': r => r.status === 200 });
    const token = res.json('token');
    if (token) {
      tokens.push(token);
    }
  }

  // warm caches for all spaces to hit the fast path
  for (const space of SPACES) {
    const r = http.get(`${BASE_URL}/api/posts?space=${space}&limit=20`, { 
      headers: { 'Content-Type': 'application/json', ...TEST_MODE_HEADER }
    });
    check(r, { [`warm ${space} 200`]: rr => rr.status === 200 });
  }

  console.log(`Setup complete: ${tokens.length} tokens obtained`);
  return { tokens };
}

/** ========= MAIN VU LOOP ========= **/
export default function (data) {
  if (!data.tokens || data.tokens.length === 0) {
    console.error('No tokens available');
    return;
  }
  
  const token = pick(data.tokens);
  const r = Math.random();

  if (r < READ_RATIO) {
    // READ: list posts
    const space = pick(SPACES);
    const res = http.get(`${BASE_URL}/api/posts?space=${space}&limit=20`, { 
      headers: { 'Content-Type': 'application/json', ...TEST_MODE_HEADER }
    });
    responseTime.add(res.timings.duration);
    httpStatus.add(1, { code: String(res.status) });
    
    if (!check(res, { 'GET 200': r => r.status === 200 && r.json('posts') })) {
      errors.add(1);
      if (__ENV.K6_LOG_ERRORS === '1') {
        console.warn('GET ERROR', res.status, res.url, (res.body || '').slice(0, 160));
      }
    }

  } else if (r < READ_RATIO + REACT_RATIO) {
    // REACT: pick a post id from a GET then react
    const space = pick(SPACES);
    const list = http.get(`${BASE_URL}/api/posts?space=${space}&limit=5`, { 
      headers: { 'Content-Type': 'application/json', ...TEST_MODE_HEADER }
    });
    
    if (list.status === 200 && Array.isArray(list.json('posts')) && list.json('posts').length) {
      const posts = list.json('posts');
      const postId = posts[0]._id || posts[0].id;
      
      if (postId) {
        const res = http.post(`${BASE_URL}/api/posts/${postId}/react`, 
          JSON.stringify({ type: 'heart' }), 
          { headers: authHeaders(token) }
        );
        responseTime.add(res.timings.duration);
        httpStatus.add(1, { code: String(res.status) });
        
        if (!check(res, { 'react 2xx/204': r => r.status === 200 || r.status === 204 })) {
          errors.add(1);
          if (__ENV.K6_LOG_ERRORS === '1') {
            console.warn('REACT ERROR', res.status, res.url, (res.body || '').slice(0, 160));
          }
        }
      }
    }

  } else {
    // WRITE: create a small post (rare in smoke)
    const payload = validPostPayload();
    const res = http.post(`${BASE_URL}/api/posts`, JSON.stringify(payload), { headers: authHeaders(token) });
    responseTime.add(res.timings.duration);
    httpStatus.add(1, { code: String(res.status) });
    
    const success = check(res, { 
      'create 201': r => r.status === 201 && (r.json('_id') || r.json('id') || r.json('post'))
    });
    
    if (!success) {
      errors.add(1);
      if (__ENV.K6_LOG_ERRORS === '1') {
        console.warn('CREATE ERROR', res.status, res.url, (res.body || '').slice(0, 160));
      }
    }
  }

  sleep(0.1);
}

export function teardown(data) {
  console.log('✅ Smoke test completed');
}