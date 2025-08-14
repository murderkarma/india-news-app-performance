# 🧪 Comprehensive Scraper Testing Guide

This guide provides a complete workflow for testing and validating your news scraper CSS selectors, database operations, and API endpoints.

## 📋 Quick Start

### 1. Install Dependencies

```bash
cd india-news-app/backend
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your MongoDB URI and OpenAI API key
```

### 3. Start Your Server

```bash
npm start
# Server should be running on http://localhost:8080
```

## 🚀 Testing Commands

### Quick Tests (Recommended for Daily Use)

```bash
# Test all sources quickly (2-3 minutes)
npm run test:quick

# Test specific state quickly
npm run test:quick -- --state Assam

# Generate health report
npm run test:quick -- --no-report  # Skip saving report
```

### Comprehensive Tests

```bash
# Full test suite with database and API validation (10-15 minutes)
npm run test:scraper

# Test specific state comprehensively
npm run test:state Assam

# Test only API endpoints
npm run test:api

# Run Jest test suite
npm test

# Run tests with coverage
npm run test:coverage
```

### Individual Source Testing

```bash
# Test a specific source's selectors
npm run scraper:test Assam "Northeast Now"

# Scrape a specific state
npm run scraper:scrape Assam
```

## 📊 Understanding Test Results

### Quick Test Output

```
🧪 Testing Northeast Now...
✅ Northeast Now: 5 valid articles
⚠️  The Assam Tribune: Only 2 articles found (expected 3+)
❌ Sentinel Assam: No articles found - check selectors

📊 QUICK TEST SUMMARY
Total Sources: 15
✅ Passed: 12
⚠️  Warnings: 2
❌ Failed: 1
Success Rate: 80.0%
```

### Comprehensive Test Report

```
📊 SCRAPER QA REPORT
📈 Overall Statistics:
   Sources Tested: 15
   Sources Passed: 12 (80.0%)
   Sources Failed: 3
   Articles Found: 67
   Valid Articles: 59 (88.1%)
   API Endpoints Working: 8/8

🔍 Source Test Results
🏛️  Assam:
   ✅ Northeast Now: 5 articles, 5 valid
   ❌ Sentinel Assam: 0 articles, 0 valid
      🔸 No articles found - check CSS selectors

💾 Database Test Results
   ✅ Assam: 5 inserted, 127 total in DB

🌐 API Test Results
   ✅ Health Check: 45ms, 0 articles
   ✅ Assam Articles: 234ms, 127 articles
```

## 🔧 Debugging Failed Sources

### Step 1: Identify the Issue

When a source fails, the test will show specific error messages:

- **"No articles found"** → CSS selectors are wrong
- **"Only X articles found"** → Selectors partially working
- **"Missing required field"** → Individual field selectors need fixing
- **"Timeout"** → Website is slow or blocking requests

### Step 2: Debug Individual Selectors

```bash
# Test specific source with detailed output
npm run scraper:test Assam "Sentinel Assam"
```

This will show you exactly what each selector is finding:

```
📄 Article 1:
   Title: NOT FOUND
   Link: NOT FOUND
   Image: NOT FOUND
   Summary: NOT FOUND
```

### Step 3: Fix Selectors in scraperTemplate.js

Open `scrapes/scraperTemplate.js` and update the selectors:

```javascript
{
  name: 'Sentinel Assam',
  url: 'https://www.sentinelassam.com/north-east-india-news/assam-news',
  selectors: {
    articles: 'div.story-card',  // ← Update this
    title: 'h3.headline',        // ← And this
    link: 'a.story-link',        // ← And this
    image: 'img.story-image',    // ← And this
    summary: 'p.excerpt'         // ← And this
  },
  fallbackImage: 'https://www.sentinelassam.com/images/logo.png'
}
```

### Step 4: Test Your Fix

```bash
npm run scraper:test Assam "Sentinel Assam"
```

### Step 5: Run Quick Test to Verify

```bash
npm run test:quick -- --state Assam
```

## 🎯 Best Practices for Selector Testing

### 1. Use Browser DevTools

1. Open the news website in your browser
2. Right-click on an article → "Inspect Element"
3. Find the container that wraps each article
4. Note the CSS selectors for title, link, image, summary

### 2. Test Selectors in Browser Console

```javascript
// Test in browser console
document.querySelectorAll("article.post").length; // Should return number of articles
document.querySelector("article.post h2.title").textContent; // Should return a title
```

### 3. Handle Different Website Structures

Some sites use different patterns:

```javascript
// Pattern 1: Standard selectors
selectors: {
  articles: 'article.post',
  title: 'h2.title a',
  link: 'h2.title a',
  image: 'img.featured',
  summary: 'div.excerpt'
}

// Pattern 2: Northeast Today style (different structure)
base_url: 'https://northeasttoday.in/tag/assam/',
article_selector: 'article.grid-item',
title_selector: 'h2.w-post-elm.post_title a',
url_selector: 'h2.w-post-elm.post_title a',
date_selector: 'time',
date_attribute: 'datetime'
```

### 4. Add Fallback Images

Always provide a fallback image for sources that don't have article images:

```javascript
{
  name: 'Source Name',
  url: 'https://example.com/news',
  selectors: {
    // ... other selectors
    image: 'img.article-image'  // This might not always exist
  },
  fallbackImage: 'https://example.com/logo.png'  // ← Always include this
}
```

## 📈 Monitoring Scraper Health

### Daily Health Checks

```bash
# Quick daily check (2 minutes)
npm run test:quick
```

### Weekly Comprehensive Tests

```bash
# Full validation (15 minutes)
npm run test:scraper
```

### Monthly Deep Dive

```bash
# Full test with coverage
npm run test:coverage

# Check API performance
npm run test:api
```

## 🚨 Common Issues and Solutions

### Issue: "No articles found"

**Cause:** Website changed their HTML structure
**Solution:**

1. Visit the website manually
2. Inspect the HTML structure
3. Update CSS selectors in `scraperTemplate.js`
4. Test with `npm run scraper:test StateName SourceName`

### Issue: "Timeout errors"

**Cause:** Website is slow or blocking requests
**Solution:**

1. Check if website is accessible
2. Increase timeout in test configuration
3. Add delays between requests
4. Consider using different User-Agent headers

### Issue: "Missing required fields"

**Cause:** Individual field selectors are incorrect
**Solution:**

1. Test each selector individually in browser console
2. Update specific field selectors
3. Ensure fallback images are configured

### Issue: "Database insertion fails"

**Cause:** MongoDB connection or validation issues
**Solution:**

1. Check MongoDB connection string in `.env`
2. Verify database is running
3. Check article schema validation

### Issue: "API endpoints not working"

**Cause:** Server not running or route issues
**Solution:**

1. Ensure server is running: `npm start`
2. Check server logs for errors
3. Test endpoints manually: `curl http://localhost:8080/api/news/ping`

## 📝 Test Reports

### Generated Files

- `test/quick-test-report.json` - Quick test results
- `test/selector-health-report.json` - Selector health analysis
- `coverage/` - Jest coverage reports (when using `npm run test:coverage`)

### Reading Health Reports

```json
{
  "timestamp": "2025-06-23T22:07:00.000Z",
  "overallHealth": "85.7",
  "stateHealth": {
    "Assam": {
      "successRate": "80.0",
      "workingSources": 4,
      "totalSources": 5
    }
  },
  "recommendations": [
    "Review failed sources for CSS selector updates",
    "Check warning sources for potential improvements"
  ]
}
```

## 🔄 Continuous Integration

### GitHub Actions (Optional)

Create `.github/workflows/scraper-tests.yml`:

```yaml
name: Scraper Tests
on:
  schedule:
    - cron: "0 6 * * *" # Daily at 6 AM
  push:
    paths:
      - "backend/scrapes/**"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: "18"
      - run: cd backend && npm install
      - run: cd backend && npm run test:quick
```

## 🎯 Success Metrics

### Target Success Rates

- **Overall Success Rate:** >85%
- **Individual State Success Rate:** >80%
- **API Response Time:** <500ms
- **Article Validation Rate:** >90%

### When to Take Action

- **Success Rate <70%:** Immediate attention needed
- **Success Rate 70-85%:** Review and improve selectors
- **Success Rate >85%:** Monitor and maintain

## 🆘 Getting Help

### Debug Mode

For detailed debugging information:

```bash
DEBUG=scraper* npm run test:quick
```

### Manual Testing

```bash
# Test individual components
node -e "
const { testSource } = require('./scrapes/scraperTemplate');
testSource('Assam', {
  name: 'Test',
  url: 'https://nenow.in/north-east-news/assam',
  selectors: {
    articles: 'article.post',
    title: 'h2.entry-title a',
    link: 'h2.entry-title a',
    image: 'figure.post-thumbnail img',
    summary: 'div.entry-summary p'
  }
}).then(console.log);
"
```

### Contact Points

- Check server logs: `tail -f server.log`
- MongoDB logs: Check your MongoDB Atlas dashboard
- API testing: Use Postman or curl for manual API testing

---

## 📚 Additional Resources

- [Cheerio Documentation](https://cheerio.js.org/) - For CSS selector syntax
- [CSS Selector Reference](https://www.w3schools.com/cssref/css_selectors.asp)
- [MongoDB Query Documentation](https://docs.mongodb.com/manual/tutorial/query-documents/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

Happy scraping! 🚀
