# Database Population Guide 🗄️

This guide shows you **multiple ways** to fill your MongoDB database with Northeast India news articles.

## 🚀 Quick Start (Recommended)

**Fastest way to get articles in your database:**

```bash
cd india-news-app/backend
npm run db:fill
```

This uses the **ScraperTemplate system** with 95.2% success rate (20/21 sources working).

## 📊 Available Methods

### 1. **ScraperTemplate System** (Recommended)

- **21 Northeast India news sources**
- **95.2% success rate** (20/21 sources working)
- **High-quality articles** with proper titles, links, images, summaries

```bash
npm run db:populate:template
```

**Sources included:**

- **Assam**: Northeast Now, Assam Tribune, Sentinel Assam, Northeast Today
- **Manipur**: Northeast Today, Frontier Manipur, Northeast Today
- **Meghalaya**: Meghalaya Monitor, Shillong Times, Northeast Today
- **Nagaland**: Nagaland Post, Morung Express, Northeast Today
- **Mizoram**: Northeast Today
- **Arunachal Pradesh**: Arunachal Times, Northeast Today, Arunachal24
- **Tripura**: Northeast Today, Tripura Times
- **Sikkim**: Northeast Today

### 2. **EastMojo System**

- **8 state-specific endpoints**
- **Different article sources**
- **Good for additional coverage**

```bash
npm run db:populate:eastmojo
```

### 3. **Combined Approach** (Maximum Coverage)

- **Uses both systems**
- **Maximum article diversity**
- **Best for comprehensive coverage**

```bash
npm run db:populate:combined
```

## 🔄 API Endpoints (Alternative)

If your server is running (`npm run dev`), you can also use API endpoints:

### Scrape Individual States (EastMojo):

```bash
# Scrape Assam
curl http://localhost:8080/api/news/scrape/assam

# Scrape Manipur
curl http://localhost:8080/api/news/scrape/manipur

# Scrape all states
for state in assam manipur meghalaya arunachal mizoram nagaland sikkim tripura; do
  curl http://localhost:8080/api/news/scrape/$state
done
```

### Enhance Articles with AI:

```bash
curl -X POST http://localhost:8080/api/news/enhance-ai-all?limit=100
```

## 📈 Monitoring & Statistics

### Check Database Status:

```bash
# Quick health check
npm run test:quick

# Comprehensive QA report
npm run test:scraper

# View articles in database
curl http://localhost:8080/api/news/ne-popular?limit=20
```

### Database Statistics:

The population scripts automatically show:

- Total articles in database
- Articles by state
- AI-enhanced articles percentage
- Success rates by source

## 🤖 AI Enhancement

After populating your database, enhance articles with AI-generated summaries and punchlines:

```bash
# Via API (server must be running)
curl -X POST http://localhost:8080/api/news/enhance-ai-all

# Or programmatically
node examples/usageExample.js
```

## 📋 Recommended Workflow

1. **Initial Population:**

   ```bash
   npm run db:fill
   ```

2. **Start Server:**

   ```bash
   npm run dev
   ```

3. **Enhance with AI:**

   ```bash
   curl -X POST http://localhost:8080/api/news/enhance-ai-all
   ```

4. **Verify Results:**
   ```bash
   curl http://localhost:8080/api/news/ne-popular?limit=10
   ```

## 🔧 Troubleshooting

### MongoDB Connection Issues:

- Ensure `.env` file has correct `MONGODB_URI`
- Check MongoDB is running
- Verify network connectivity

### Low Success Rates:

- Run `npm run test:quick` to check source health
- Some websites may be temporarily down
- CSS selectors may need updates if sites change

### API Errors:

- Ensure server is running: `npm run dev`
- Check server logs for detailed error messages
- Verify endpoints with: `curl http://localhost:8080/api/news/ping`

## 📊 Expected Results

With the **ScraperTemplate system**, you should expect:

- **~60-200 articles** per successful run
- **95.2% source success rate** (20/21 sources)
- **High-quality data** with proper titles, links, images
- **Automatic deduplication** (no duplicate articles)

## 🔄 Scheduling (Optional)

For continuous updates, you can schedule the population script:

```bash
# Add to crontab for daily updates at 6 AM
0 6 * * * cd /path/to/india-news-app/backend && npm run db:fill

# Or use node-cron in your application
```

## 🎯 Next Steps

After populating your database:

1. **Test your API endpoints**
2. **Integrate with your frontend**
3. **Set up scheduled scraping**
4. **Monitor source health regularly**
5. **Add new sources as needed**

---

**Need help?** Check the test results with `npm run test:quick` or review the comprehensive QA report with `npm run test:scraper`.
