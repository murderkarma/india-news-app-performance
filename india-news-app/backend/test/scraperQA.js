#!/usr/bin/env node

/**
 * Comprehensive Scraper Quality Assurance Tool
 * 
 * This script validates:
 * 1. CSS selector accuracy for each source
 * 2. Database insertion and data integrity
 * 3. API endpoint functionality
 * 4. Article structure validation (fallback images, etc.)
 * 
 * Usage:
 *   node test/scraperQA.js --full              # Test all states and sources
 *   node test/scraperQA.js --state Assam       # Test specific state
 *   node test/scraperQA.js --source "Northeast Now" --state Assam  # Test specific source
 *   node test/scraperQA.js --api-only          # Only test API endpoints
 */

const mongoose = require('mongoose');
const axios = require('axios');
const { testSource, scrapeSource, STATE_CONFIGS } = require('../scrapes/scraperTemplate');
const Article = require('../articleModel');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Configuration
const CONFIG = {
  API_BASE_URL: 'http://localhost:8080/api/news',
  MIN_ARTICLES_PER_SOURCE: 3,
  MAX_ARTICLES_PER_SOURCE: 10,
  TEST_TIMEOUT: 30000, // 30 seconds per source
  REQUIRED_FIELDS: ['title', 'link', 'state', 'source'],
  OPTIONAL_FIELDS: ['image', 'summary', 'aiPunchline', 'aiSummary']
};

// Logging utilities with colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  debug: (msg) => console.log(`${colors.cyan}🔍 ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.magenta}🚀 ${msg}${colors.reset}\n`),
  subheader: (msg) => console.log(`\n${colors.bright}${colors.cyan}📋 ${msg}${colors.reset}`)
};

// Test results tracking
class TestResults {
  constructor() {
    this.results = {
      sources: {},
      database: {},
      api: {},
      summary: {
        totalSources: 0,
        passedSources: 0,
        failedSources: 0,
        totalArticles: 0,
        validArticles: 0,
        apiEndpointsWorking: 0,
        apiEndpointsTotal: 0
      }
    };
  }

  addSourceResult(state, sourceName, result) {
    if (!this.results.sources[state]) {
      this.results.sources[state] = {};
    }
    this.results.sources[state][sourceName] = result;
    this.results.summary.totalSources++;
    if (result.success) {
      this.results.summary.passedSources++;
    } else {
      this.results.summary.failedSources++;
    }
    this.results.summary.totalArticles += result.articlesFound || 0;
    this.results.summary.validArticles += result.validArticles || 0;
  }

  addDatabaseResult(state, result) {
    this.results.database[state] = result;
  }

  addApiResult(endpoint, result) {
    this.results.api[endpoint] = result;
    this.results.summary.apiEndpointsTotal++;
    if (result.success) {
      this.results.summary.apiEndpointsWorking++;
    }
  }

  generateReport() {
    log.header('📊 SCRAPER QA REPORT');
    
    // Summary
    const { summary } = this.results;
    console.log(`📈 Overall Statistics:`);
    console.log(`   Sources Tested: ${summary.totalSources}`);
    console.log(`   Sources Passed: ${summary.passedSources} (${((summary.passedSources/summary.totalSources)*100).toFixed(1)}%)`);
    console.log(`   Sources Failed: ${summary.failedSources}`);
    console.log(`   Articles Found: ${summary.totalArticles}`);
    console.log(`   Valid Articles: ${summary.validArticles} (${((summary.validArticles/summary.totalArticles)*100).toFixed(1)}%)`);
    console.log(`   API Endpoints Working: ${summary.apiEndpointsWorking}/${summary.apiEndpointsTotal}`);

    // Detailed source results
    log.subheader('🔍 Source Test Results');
    Object.entries(this.results.sources).forEach(([state, sources]) => {
      console.log(`\n🏛️  ${state}:`);
      Object.entries(sources).forEach(([sourceName, result]) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${sourceName}: ${result.articlesFound || 0} articles, ${result.validArticles || 0} valid`);
        if (result.issues && result.issues.length > 0) {
          result.issues.forEach(issue => {
            console.log(`      🔸 ${issue}`);
          });
        }
      });
    });

    // Database results
    if (Object.keys(this.results.database).length > 0) {
      log.subheader('💾 Database Test Results');
      Object.entries(this.results.database).forEach(([state, result]) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${state}: ${result.inserted || 0} inserted, ${result.total || 0} total in DB`);
      });
    }

    // API results
    if (Object.keys(this.results.api).length > 0) {
      log.subheader('🌐 API Test Results');
      Object.entries(this.results.api).forEach(([endpoint, result]) => {
        const status = result.success ? '✅' : '❌';
        console.log(`   ${status} ${endpoint}: ${result.responseTime}ms, ${result.articlesReturned || 0} articles`);
        if (result.error) {
          console.log(`      🔸 Error: ${result.error}`);
        }
      });
    }

    // Recommendations
    log.subheader('💡 Recommendations');
    if (summary.failedSources > 0) {
      log.warning(`${summary.failedSources} sources failed. Check CSS selectors and website structure changes.`);
    }
    if (summary.validArticles / summary.totalArticles < 0.8) {
      log.warning('Less than 80% of articles are valid. Review data validation rules.');
    }
    if (summary.apiEndpointsWorking < summary.apiEndpointsTotal) {
      log.warning('Some API endpoints are not working. Check server status and routes.');
    }
    if (summary.passedSources === summary.totalSources && summary.apiEndpointsWorking === summary.apiEndpointsTotal) {
      log.success('All tests passed! Your scraper is working perfectly. 🎉');
    }
  }
}

// Article validation
function validateArticle(article, sourceName) {
  const issues = [];
  
  // Check required fields
  CONFIG.REQUIRED_FIELDS.forEach(field => {
    if (!article[field] || article[field].toString().trim() === '') {
      issues.push(`Missing required field: ${field}`);
    }
  });

  // Validate URL format
  if (article.link && !article.link.startsWith('http')) {
    issues.push('Link is not a valid URL');
  }

  // Check title length (too short might indicate selector issues)
  if (article.title && article.title.length < 10) {
    issues.push('Title too short (possible selector issue)');
  }

  // Check for image fallback
  if (!article.image) {
    issues.push('No image found (fallback should be applied)');
  }

  // Check for duplicate detection
  if (article.title && article.title.toLowerCase().includes('undefined')) {
    issues.push('Title contains "undefined" (selector issue)');
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

// Test individual source
async function testSourceWithValidation(state, sourceConfig, testResults) {
  const sourceName = sourceConfig.name;
  log.info(`Testing ${sourceName} for ${state}...`);
  
  const startTime = Date.now();
  const result = {
    success: false,
    articlesFound: 0,
    validArticles: 0,
    issues: [],
    responseTime: 0
  };

  try {
    // Test scraping
    const articles = await Promise.race([
      testSource(state, sourceConfig),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), CONFIG.TEST_TIMEOUT)
      )
    ]);

    result.responseTime = Date.now() - startTime;
    result.articlesFound = articles.length;

    if (articles.length === 0) {
      result.issues.push('No articles found - check CSS selectors');
      testResults.addSourceResult(state, sourceName, result);
      return result;
    }

    if (articles.length < CONFIG.MIN_ARTICLES_PER_SOURCE) {
      result.issues.push(`Only ${articles.length} articles found (minimum: ${CONFIG.MIN_ARTICLES_PER_SOURCE})`);
    }

    // Validate each article
    let validCount = 0;
    articles.forEach((article, index) => {
      const validation = validateArticle(article, sourceName);
      if (validation.isValid) {
        validCount++;
      } else {
        result.issues.push(`Article ${index + 1}: ${validation.issues.join(', ')}`);
      }
    });

    result.validArticles = validCount;
    result.success = validCount >= CONFIG.MIN_ARTICLES_PER_SOURCE && result.issues.length === 0;

    if (result.success) {
      log.success(`${sourceName}: ${validCount}/${articles.length} valid articles`);
    } else {
      log.warning(`${sourceName}: Issues found`);
    }

  } catch (error) {
    result.issues.push(`Scraping failed: ${error.message}`);
    result.responseTime = Date.now() - startTime;
    log.error(`${sourceName}: ${error.message}`);
  }

  testResults.addSourceResult(state, sourceName, result);
  return result;
}

// Test database insertion
async function testDatabaseInsertion(state, testResults) {
  log.info(`Testing database insertion for ${state}...`);
  
  try {
    const beforeCount = await Article.countDocuments({ state });
    
    // Get first working source for this state
    const stateConfig = STATE_CONFIGS[state];
    if (!stateConfig || !stateConfig.sources.length) {
      throw new Error(`No sources configured for ${state}`);
    }

    const sourceConfig = stateConfig.sources[0];
    const articles = await scrapeSource(state, sourceConfig);
    
    if (articles.length === 0) {
      throw new Error('No articles to insert');
    }

    // Insert articles
    const insertedArticles = await Article.insertMany(articles, { ordered: false });
    const afterCount = await Article.countDocuments({ state });
    
    const result = {
      success: true,
      inserted: insertedArticles.length,
      total: afterCount,
      beforeCount
    };

    testResults.addDatabaseResult(state, result);
    log.success(`Database: Inserted ${insertedArticles.length} articles for ${state}`);
    
    return result;
  } catch (error) {
    const result = {
      success: false,
      error: error.message,
      inserted: 0,
      total: await Article.countDocuments({ state }).catch(() => 0)
    };
    
    testResults.addDatabaseResult(state, result);
    log.error(`Database insertion failed for ${state}: ${error.message}`);
    return result;
  }
}

// Test API endpoints
async function testApiEndpoints(states, testResults) {
  log.info('Testing API endpoints...');
  
  const endpoints = [
    { name: 'Health Check', url: `${CONFIG.API_BASE_URL}/ping` },
    { name: 'All Articles', url: `${CONFIG.API_BASE_URL}/` },
    { name: 'Northeast Popular', url: `${CONFIG.API_BASE_URL}/ne-popular` },
    ...states.map(state => ({
      name: `${state} Articles`,
      url: `${CONFIG.API_BASE_URL}/state/${state.toLowerCase()}`
    }))
  ];

  for (const endpoint of endpoints) {
    const startTime = Date.now();
    try {
      const response = await axios.get(endpoint.url, { timeout: 10000 });
      const responseTime = Date.now() - startTime;
      
      const result = {
        success: response.status === 200,
        responseTime,
        articlesReturned: Array.isArray(response.data) ? response.data.length : 
                         response.data.articles ? response.data.articles.length : 0
      };

      testResults.addApiResult(endpoint.name, result);
      log.success(`API ${endpoint.name}: ${responseTime}ms`);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const result = {
        success: false,
        responseTime,
        error: error.message,
        articlesReturned: 0
      };

      testResults.addApiResult(endpoint.name, result);
      log.error(`API ${endpoint.name}: ${error.message}`);
    }
  }
}

// Main test runner
async function runTests(options = {}) {
  const testResults = new TestResults();
  
  try {
    // Connect to MongoDB
    log.info('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    log.success('Connected to MongoDB');

    // Determine what to test
    const statesToTest = options.state ? [options.state] : Object.keys(STATE_CONFIGS);
    
    if (!options.apiOnly) {
      // Test sources
      log.header('🔍 Testing CSS Selectors and Data Extraction');
      
      for (const state of statesToTest) {
        const stateConfig = STATE_CONFIGS[state];
        if (!stateConfig) {
          log.warning(`No configuration found for ${state}`);
          continue;
        }

        log.subheader(`Testing ${state} (${stateConfig.sources.length} sources)`);
        
        const sourcesToTest = options.source ? 
          stateConfig.sources.filter(s => s.name === options.source) : 
          stateConfig.sources;

        for (const sourceConfig of sourcesToTest) {
          await testSourceWithValidation(state, sourceConfig, testResults);
          // Small delay between sources
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Test database insertion for this state
        if (!options.skipDatabase) {
          await testDatabaseInsertion(state, testResults);
        }
      }
    }

    // Test API endpoints
    if (!options.skipApi) {
      log.header('🌐 Testing API Endpoints');
      await testApiEndpoints(statesToTest, testResults);
    }

    // Generate report
    testResults.generateReport();

  } catch (error) {
    log.error(`Test runner failed: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--state':
        options.state = args[++i];
        break;
      case '--source':
        options.source = args[++i];
        break;
      case '--api-only':
        options.apiOnly = true;
        break;
      case '--skip-database':
        options.skipDatabase = true;
        break;
      case '--skip-api':
        options.skipApi = true;
        break;
      case '--full':
        // Test everything (default behavior)
        break;
      case '--help':
        console.log(`
Scraper QA Tool Usage:

  node test/scraperQA.js [options]

Options:
  --full                    Test all states and sources (default)
  --state <StateName>       Test specific state only
  --source <SourceName>     Test specific source (requires --state)
  --api-only               Only test API endpoints
  --skip-database          Skip database insertion tests
  --skip-api               Skip API endpoint tests
  --help                   Show this help message

Examples:
  node test/scraperQA.js --full
  node test/scraperQA.js --state Assam
  node test/scraperQA.js --state Assam --source "Northeast Now"
  node test/scraperQA.js --api-only
        `);
        process.exit(0);
        break;
    }
  }

  runTests(options).catch(error => {
    log.error(`QA process failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  validateArticle,
  testSourceWithValidation,
  TestResults
};