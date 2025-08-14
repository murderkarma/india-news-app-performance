# AI Content Generation Utility

A modular utility for generating punchy headlines and AI-powered summaries for India's state-wise news articles.

## Overview

This utility transforms raw scraped news articles into engaging, social media-ready content with:

- **Punchy Headlines**: Reddit-style, clickable titles (max 80 characters)
- **AI Summaries**: Concise 2-3 sentence summaries
- **State Context**: Cultural awareness for each Indian state
- **Fallback Support**: Graceful degradation when AI fails

## Quick Start

### 1. Installation

```bash
cd backend
npm install openai
```

### 2. Environment Setup

Add to your `.env` file:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Basic Usage

```javascript
const { generateArticleContent } = require("./utils/aiUtils");

const article = {
  title: "Assam Tea Gardens Face Water Shortage",
  body: "Tea gardens across Assam are experiencing severe water shortage...",
  state: "Assam",
  source: "EastMojo",
};

const result = await generateArticleContent(article);
console.log(result.punchline); // "🚨 Assam's Tea Crisis: 200+ Gardens Hit by Drought"
console.log(result.summary); // "Over 200 tea estates in Assam face severe water..."
```

## API Reference

### Core Functions

#### `generateArticleContent(article)`

Generates AI content for a single article.

**Parameters:**

- `article` (Object): Article data
  - `title` (string): Original title
  - `body` (string, optional): Article content
  - `state` (string): Indian state
  - `source` (string, optional): News source

**Returns:**

```javascript
{
  punchline: "Engaging headline (max 80 chars)",
  summary: "2-3 sentence summary"
}
```

#### `batchGenerateContent(articles, batchSize)`

Process multiple articles efficiently.

**Parameters:**

- `articles` (Array): Array of article objects
- `batchSize` (number, default: 3): Concurrent processing limit

**Returns:**

```javascript
[
  {
    ...originalArticle,
    title: "AI-generated punchline",
    summary: "AI-generated summary",
    originalTitle: "Original title",
    aiGenerated: true,
    processedAt: Date,
  },
];
```

#### `enhancedArticleProcessing(article, options)`

Advanced processing with tone and context control.

**Parameters:**

- `article` (Object): Article data
- `options` (Object):
  - `includeStateContext` (boolean, default: true)
  - `tone` (string): 'casual', 'formal', 'urgent'

## Integration Examples

### With Scraper Pipeline

```javascript
// assamScraper.js
const { batchGenerateContent } = require("../utils/aiUtils");

async function scrapeAssamNews() {
  // 1. Scrape raw articles
  const rawArticles = await scrapeFromSources();

  // 2. Generate AI content
  const enhancedArticles = await batchGenerateContent(rawArticles);

  // 3. Save to database
  for (const article of enhancedArticles) {
    await Article.findOneAndUpdate(
      { link: article.link },
      {
        title: article.title, // AI punchline
        summary: article.summary, // AI summary
        originalTitle: article.originalTitle,
        aiGenerated: article.aiGenerated,
      },
      { upsert: true }
    );
  }
}
```

### Scheduled Processing

```javascript
// scheduler.js
const cron = require("node-cron");
const { scrapeAssamNews } = require("./scrapes/assamScraper");

// Run every 6 hours
cron.schedule("0 */6 * * *", async () => {
  console.log("🕐 Starting scheduled Assam news scraping...");
  const results = await scrapeAssamNews();
  console.log(`✅ Processed ${results.aiProcessed} articles`);
});
```

### Single Article Processing

```javascript
// For testing or manual processing
const { processSingleArticle } = require("./scrapes/assamScraper");

const testArticle = {
  title: "Breaking: New Development in Assam",
  body: "Article content here...",
  state: "Assam",
  link: "https://example.com/article",
};

const result = await processSingleArticle(testArticle);
```

## State-Specific Features

The utility includes cultural context for all Northeast Indian states:

```javascript
const stateContext = {
  Assam: "tea gardens, Brahmaputra river, one-horned rhinos, Bihu festival",
  Manipur: "Loktak Lake, classical dance, martial arts, sports culture",
  Meghalaya: "living root bridges, wettest place on earth, tribal culture",
  // ... more states
};
```

This context helps generate more relevant and engaging content for each state's audience.

## Configuration

### AI Settings (`config/aiConfig.js`)

```javascript
const AI_CONFIG = {
  openai: {
    model: "gpt-3.5-turbo",
    maxTokens: 300,
    temperature: 0.7,
  },
  content: {
    maxHeadlineLength: 80,
    batchSize: 3,
  },
  rateLimits: {
    requestsPerMinute: 20,
  },
};
```

### Tone Options

- **casual**: Friendly, conversational tone
- **formal**: Professional news style
- **urgent**: Breaking news, attention-grabbing
- **engaging**: Social media optimized

## Error Handling & Fallbacks

The utility includes robust error handling:

1. **API Failures**: Falls back to original title and basic summary
2. **Rate Limiting**: Automatic retry with exponential backoff
3. **Invalid Responses**: Graceful degradation
4. **Network Issues**: Timeout handling

```javascript
// Fallback example
{
  punchline: article.title || 'Breaking News from ' + article.state,
  summary: article.body
    ? article.body.substring(0, 200) + '...'
    : `Latest news update from ${article.state}.`
}
```

## Testing

Run the test suite:

```bash
cd backend
node test/testAiUtils.js
```

Test individual functions:

```javascript
const { testSingleArticle } = require("./test/testAiUtils");
await testSingleArticle();
```

## Performance Considerations

- **Batch Processing**: Process 3 articles concurrently by default
- **Rate Limiting**: Respects OpenAI API limits
- **Caching**: Consider implementing Redis for repeated content
- **Monitoring**: Track API usage and costs

## Database Schema Updates

The enhanced article model includes:

```javascript
{
  title: String,           // AI-generated punchline
  summary: String,         // AI-generated summary
  originalTitle: String,   // Original scraped title
  aiGenerated: Boolean,    // Processing status
  processedAt: Date,       // When AI processing occurred
  source: String,          // News source
  scrapedAt: Date         // When article was scraped
}
```

## Cost Optimization

- Use `gpt-3.5-turbo` for cost efficiency
- Batch process articles to reduce API calls
- Implement caching for similar content
- Monitor token usage with shorter prompts

## Scaling to All 28 States

1. **Create state-specific scrapers** following the Assam example
2. **Use shared AI utility** for consistent content generation
3. **Configure state context** in `aiConfig.js`
4. **Schedule scrapers** independently for each state

```javascript
// Example for all states
const states = ["Assam", "Manipur", "Meghalaya" /* ... all 28 states */];

states.forEach((state) => {
  cron.schedule("0 */6 * * *", () => {
    scrapeStateNews(state);
  });
});
```

## Troubleshooting

### Common Issues

1. **"Invalid JSON response"**: Check OpenAI API key and model availability
2. **Rate limit errors**: Reduce batch size or increase delays
3. **Empty summaries**: Ensure article body content is available
4. **Long headlines**: Automatic truncation at 100 characters

### Debug Mode

Enable detailed logging:

```javascript
process.env.DEBUG_AI = "true";
```

## Future Enhancements

- [ ] Multi-language support (Hindi, regional languages)
- [ ] Sentiment analysis integration
- [ ] Trending topic detection
- [ ] Image caption generation
- [ ] Social media optimization scores
- [ ] A/B testing for headline effectiveness

---

**Ready to transform your news content!** 🚀

For questions or issues, check the test files or create an issue in the repository.
