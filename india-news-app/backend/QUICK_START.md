# Quick Start: AI Content Generation

## 🚀 Get Started in 3 Steps

### 1. Setup (30 seconds)

```bash
# Already installed: npm install openai
echo "OPENAI_API_KEY=your_key_here" >> .env
```

### 2. Basic Usage (Copy & Paste)

```javascript
const { generateArticleContent } = require("./utils/aiUtils");

// Transform any article
const result = await generateArticleContent({
  title: "Your scraped title",
  body: "Article content...",
  state: "Assam",
  source: "EastMojo",
});

console.log(result.punchline); // Engaging headline
console.log(result.summary); // 2-3 sentence summary
```

### 3. Scraper Integration (Replace your save logic)

```javascript
// OLD WAY
await Article.create({
  title: scrapedTitle,
  summary: "",
  // ...
});

// NEW WAY (with AI)
const { batchGenerateContent } = require("./utils/aiUtils");

const enhanced = await batchGenerateContent(scrapedArticles);
for (const article of enhanced) {
  await Article.findOneAndUpdate(
    { link: article.link },
    {
      title: article.title, // AI punchline
      summary: article.summary, // AI summary
      originalTitle: article.originalTitle,
    },
    { upsert: true }
  );
}
```

## 📱 What Your Users See

**Before AI:**

```
Title: "Assam Government Announces New Tea Garden Welfare Scheme"
Summary: ""
```

**After AI:**

```
Title: "🚨 Major Win for Assam Tea Workers: New Welfare Scheme Announced"
Summary: "The Assam government launches comprehensive benefits for 1M+ tea garden workers. Healthcare, education support, and housing assistance included in the groundbreaking scheme."
```

## 🔧 Test It Now

```bash
cd backend
node examples/usageExample.js
```

## 📊 Files You Need

- ✅ `utils/aiUtils.js` - Main utility (created)
- ✅ `config/aiConfig.js` - Settings (created)
- ✅ `scrapes/assamScraper.js` - Example integration (created)
- ⚠️ `.env` - Add your OpenAI API key

## 🎯 Next Steps

1. **Add API key** to `.env`
2. **Test with real articles**
3. **Update your scrapers** using the Assam example
4. **Scale to all states**

---

**That's it! Your news app now generates engaging, social media-ready content automatically.** 🎉
