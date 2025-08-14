# 🎯 Scraper QA Workflow - Complete Implementation

## 📋 What You Now Have

I've created a comprehensive testing and validation system for your news scraper with the following components:

### 🧪 Testing Tools

1. **`test/scraperQA.js`** - Comprehensive QA tool

   - Tests all sources across all states
   - Validates database insertion
   - Tests API endpoints
   - Generates detailed reports

2. **`test/batchTest.js`** - Quick validation tool

   - Fast testing for daily use
   - Concurrent testing for efficiency
   - Health monitoring and reports

3. **`test/scraper.test.js`** - Jest test suite

   - Automated unit and integration tests
   - CI/CD ready
   - Coverage reporting

4. **`test/selectorDebugger.js`** - Interactive debugging
   - Real-time selector testing
   - Suggestions for improvements
   - Source configuration debugging

### 📊 Enhanced Package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:scraper": "node test/scraperQA.js --full",
    "test:quick": "node test/batchTest.js",
    "test:state": "node test/scraperQA.js --state",
    "test:api": "node test/scraperQA.js --api-only",
    "scraper:test": "node scrapes/scraperTemplate.js test",
    "scraper:scrape": "node scrapes/scraperTemplate.js scrape"
  }
}
```

## 🚀 Quick Start Guide

### 1. Install Dependencies

```bash
cd india-news-app/backend
npm install
```

### 2. Daily Quick Check (2 minutes)

```bash
npm run test:quick
```

### 3. Weekly Comprehensive Test (15 minutes)

```bash
npm run test:scraper
```

### 4. Debug Specific Issues

```bash
# Interactive debugging
node test/selectorDebugger.js

# Test specific source
npm run scraper:test Assam "Northeast Now"
```

## 📈 Testing Workflow

### Phase 1: Quick Validation

```bash
# Test all sources quickly
npm run test:quick

# Expected output:
# 🧪 Testing Northeast Now...
# ✅ Northeast Now: 5 valid articles
# ⚠️  The Assam Tribune: Only 2 articles found
# ❌ Sentinel Assam: No articles found - check selectors
#
# 📊 QUICK TEST SUMMARY
# Success Rate: 85.7%
```

### Phase 2: Fix Issues

```bash
# Debug failed sources interactively
node test/selectorDebugger.js

# In the debugger:
debugger> source
Enter state name: Assam
Enter source number: 3
# Shows detailed selector testing
```

### Phase 3: Comprehensive Validation

```bash
# Full test with database and API validation
npm run test:scraper

# Expected output:
# 📊 SCRAPER QA REPORT
# Sources Passed: 12/15 (80.0%)
# Articles Found: 67
# Valid Articles: 59 (88.1%)
# API Endpoints Working: 8/8
```

### Phase 4: Automated Testing

```bash
# Run Jest test suite
npm test

# With coverage
npm run test:coverage
```

## 🔧 Debugging Common Issues

### Issue: "No articles found"

```bash
# Step 1: Debug the source
node test/selectorDebugger.js
debugger> config Assam "Sentinel Assam"
debugger> load https://www.sentinelassam.com/north-east-india-news/assam-news
debugger> test div.story-card
debugger> suggest div.story-card

# Step 2: Update selectors in scraperTemplate.js
# Step 3: Test the fix
npm run scraper:test Assam "Sentinel Assam"
```

### Issue: "Missing required fields"

```bash
# Test individual field selectors
debugger> test h3.headline        # For titles
debugger> test a.story-link       # For links
debugger> test img.story-image    # For images
```

### Issue: "API endpoints not working"

```bash
# Test API only
npm run test:api

# Manual API testing
curl http://localhost:8080/api/news/ping
curl http://localhost:8080/api/news/state/assam
```

## 📊 Understanding Reports

### Quick Test Report (`quick-test-report.json`)

```json
{
  "timestamp": "2025-06-23T22:07:00.000Z",
  "summary": {
    "total": 15,
    "passed": 12,
    "failed": 2,
    "warnings": 1
  },
  "results": [
    {
      "state": "Assam",
      "sourceName": "Northeast Now",
      "status": "pass",
      "articlesFound": 5,
      "validArticles": 5
    }
  ]
}
```

### Selector Health Report (`selector-health-report.json`)

```json
{
  "overallHealth": "85.7",
  "stateHealth": {
    "Assam": {
      "successRate": "80.0",
      "workingSources": 4,
      "totalSources": 5
    }
  },
  "recommendations": ["Review failed sources for CSS selector updates"]
}
```

## 🎯 Success Metrics

### Target Benchmarks

- **Overall Success Rate:** >85%
- **Individual State Success Rate:** >80%
- **API Response Time:** <500ms
- **Article Validation Rate:** >90%

### Action Thresholds

- **Success Rate <70%:** 🚨 Immediate attention needed
- **Success Rate 70-85%:** ⚠️ Review and improve selectors
- **Success Rate >85%:** ✅ Monitor and maintain

## 🔄 Maintenance Schedule

### Daily (2 minutes)

```bash
npm run test:quick
```

### Weekly (15 minutes)

```bash
npm run test:scraper
```

### Monthly (30 minutes)

```bash
npm run test:coverage
# Review health reports
# Update selectors for failed sources
# Add new sources if needed
```

## 🛠️ Advanced Usage

### Testing Specific Components

```bash
# Test only database operations
npm run test:scraper -- --skip-api

# Test only API endpoints
npm run test:api

# Test specific state
npm run test:state Assam

# Test with custom timeout
TIMEOUT=60000 npm run test:quick
```

### Debugging with Browser DevTools

1. Open the news website in your browser
2. Right-click on an article → "Inspect Element"
3. Find the container that wraps each article
4. Test selectors in browser console:
   ```javascript
   document.querySelectorAll("article.post").length;
   document.querySelector("article.post h2.title").textContent;
   ```
5. Update selectors in `scraperTemplate.js`
6. Test with: `npm run scraper:test StateName SourceName`

### Interactive Selector Development

```bash
node test/selectorDebugger.js
debugger> load https://nenow.in/north-east-news/assam
debugger> test article.post
debugger> suggest article.post
debugger> test article.post h2.entry-title a
```

## 📚 File Structure

```
backend/
├── test/
│   ├── scraperQA.js           # Comprehensive QA tool
│   ├── batchTest.js           # Quick validation
│   ├── scraper.test.js        # Jest test suite
│   ├── selectorDebugger.js    # Interactive debugger
│   ├── quick-test-report.json # Generated reports
│   └── selector-health-report.json
├── scrapes/
│   └── scraperTemplate.js     # Your source configurations
├── package.json               # Updated with test scripts
└── SCRAPER_TESTING_GUIDE.md   # Detailed documentation
```

## 🎉 Next Steps

1. **Install dependencies:** `npm install`
2. **Run quick test:** `npm run test:quick`
3. **Fix any failed sources** using the interactive debugger
4. **Set up daily monitoring** with `npm run test:quick`
5. **Schedule weekly comprehensive tests** with `npm run test:scraper`

## 🆘 Troubleshooting

### Common Issues

1. **MongoDB connection errors**

   - Check `.env` file has correct `MONGODB_URI`
   - Ensure MongoDB is running

2. **Timeout errors**

   - Some websites are slow - this is normal
   - Increase timeout in test configuration if needed

3. **Selector not working**

   - Website may have changed structure
   - Use interactive debugger to find new selectors

4. **API tests failing**
   - Ensure server is running: `npm start`
   - Check server logs for errors

### Getting Help

- **Debug mode:** `DEBUG=scraper* npm run test:quick`
- **Interactive debugging:** `node test/selectorDebugger.js`
- **Manual testing:** Use browser DevTools to inspect HTML
- **Server logs:** Check console output when running `npm start`

---

## 🎯 Summary

You now have a complete testing ecosystem that:

✅ **Validates CSS selectors** for all your news sources  
✅ **Tests database insertion** and data integrity  
✅ **Verifies API endpoints** are working correctly  
✅ **Provides interactive debugging** for fixing issues  
✅ **Generates health reports** for monitoring  
✅ **Supports automated testing** with Jest  
✅ **Includes comprehensive documentation**

This system will help you maintain high-quality news scraping with minimal manual effort. Run `npm run test:quick` daily to catch issues early, and use the interactive debugger when you need to fix selectors.

Happy scraping! 🚀
