# 🚀 Scraper Setup Guide for All States

## 📋 **Step-by-Step Process**

### **Step 1: Find News Sources for Each State**

For each state, find 2-3 reliable news websites that cover local news. Here are some suggestions:

#### **Common Northeast India News Sources:**

- **EastMojo** - Covers all Northeast states (eastmojo.com)
- **The Sentinel** - Assam focused (sentinelassam.com)
- **Imphal Free Press** - Manipur focused (ifp.co.in)
- **The Shillong Times** - Meghalaya focused (theshillongtimes.com)
- **Nagaland Post** - Nagaland focused (nagalandpost.com)
- **Arunachal Times** - Arunachal Pradesh focused
- **Local newspapers** with online presence

### **Step 2: Find CSS Selectors for Each Source**

For each news source, you need to find these CSS selectors:

1. **Articles container** - The element that wraps each article
2. **Title selector** - Where the headline is located
3. **Link selector** - Where the article URL is located
4. **Image selector** - Where the featured image is located
5. **Summary selector** - Where the excerpt/description is located

#### **How to Find CSS Selectors:**

1. **Open the news website** in Chrome/Firefox
2. **Right-click on an article title** → "Inspect Element"
3. **Find the container** that wraps the entire article
4. **Note the class names** for each element you need

#### **Example Process:**

```bash
# Test your selectors before adding them
cd india-news-app/backend
node scrapes/scraperTemplate.js test Assam EastMojo
```

### **Step 3: Add Sources to Configuration**

Edit `scraperTemplate.js` and add your sources to the `STATE_CONFIGS` object:

```javascript
'Manipur': {
  sources: [
    {
      name: 'EastMojo',
      url: 'https://eastmojo.com/category/manipur/',
      selectors: {
        articles: '.post-item',           // Container for each article
        title: '.post-title a',          // Article title
        link: '.post-title a',           // Article link
        image: '.post-thumbnail img',    // Article image
        summary: '.post-excerpt'         // Article summary
      }
    },
    {
      name: 'Imphal Free Press',
      url: 'https://www.ifp.co.in/category/manipur',
      selectors: {
        articles: '.post',               // REPLACE with actual selectors
        title: '.entry-title a',        // REPLACE with actual selectors
        link: '.entry-title a',         // REPLACE with actual selectors
        image: '.post-thumbnail img',   // REPLACE with actual selectors
        summary: '.entry-summary'       // REPLACE with actual selectors
      }
    }
  ]
}
```

### **Step 4: Test Each Source**

Before adding a source to your configuration, test it:

```bash
# Test individual sources
node scrapes/scraperTemplate.js test Manipur "Imphal Free Press"
node scrapes/scraperTemplate.js test Assam EastMojo
node scrapes/scraperTemplate.js test Meghalaya "The Shillong Times"
```

### **Step 5: Create State-Specific Scrapers (Optional)**

If you prefer separate files for each state:

```bash
# Copy the template for each state
cp scrapes/scraperTemplate.js scrapes/manipurScraper.js
cp scrapes/scraperTemplate.js scrapes/meghalayaScraper.js
# etc.
```

Then modify each file to focus on that specific state.

## 🎯 **Recommended Approach**

### **Option A: Universal Scraper (Recommended)**

- ✅ One file manages all states
- ✅ Easy to maintain and update
- ✅ Consistent AI enhancement across all states
- ✅ Single command to scrape all states

### **Option B: Individual State Scrapers**

- ✅ More focused and easier to debug per state
- ✅ Can customize scraping logic per state
- ❌ More files to maintain
- ❌ Need to run multiple commands

## 📝 **Quick Start Checklist**

### **For Each State:**

1. **Find 2-3 news sources**

   - [ ] Primary source (usually EastMojo)
   - [ ] Local newspaper website
   - [ ] Regional news portal

2. **Extract CSS selectors**

   - [ ] Articles container selector
   - [ ] Title selector
   - [ ] Link selector
   - [ ] Image selector
   - [ ] Summary selector

3. **Test the selectors**

   ```bash
   node scrapes/scraperTemplate.js test StateName SourceName
   ```

4. **Add to configuration**

   - [ ] Add source to STATE_CONFIGS
   - [ ] Verify all selectors work

5. **Test full scraping**
   ```bash
   node scrapes/scraperTemplate.js scrape StateName
   ```

## 🔧 **Common CSS Selector Patterns**

Most news websites use similar patterns:

```javascript
// Common patterns you'll likely find:
{
  articles: '.post', '.article', '.news-item', '.post-item',
  title: '.title', '.headline', '.post-title', '.entry-title',
  link: '.title a', '.headline a', '.post-title a',
  image: '.featured-image img', '.post-thumbnail img', '.thumb img',
  summary: '.excerpt', '.summary', '.description', '.post-excerpt'
}
```

## 🚀 **Running the Scrapers**

### **Test a single source:**

```bash
node scrapes/scraperTemplate.js test Assam EastMojo
```

### **Scrape a single state:**

```bash
node scrapes/scraperTemplate.js scrape Assam
```

### **Scrape all configured states:**

```bash
node scrapes/scraperTemplate.js scrape-all
```

## 📊 **Expected Output**

When working correctly, you should see:

```
🧪 Testing EastMojo for Assam...
📍 URL: https://eastmojo.com/category/assam/
✅ Page loaded successfully
📰 Found 12 article containers

📄 Article 1:
   Title: Assam government announces new digital literacy program
   Link: https://eastmojo.com/article/123
   Image: https://eastmojo.com/image.jpg
   Summary: The Assam government has launched...

✅ Successfully extracted 3 articles
```

## ⚠️ **Troubleshooting**

### **No articles found:**

- Check if the website structure changed
- Verify CSS selectors are correct
- Check if the website blocks scrapers

### **Missing titles/links:**

- Inspect the HTML structure again
- Try different selector combinations
- Check for dynamic content loading

### **Images not loading:**

- Check if images use `src` or `data-src` attributes
- Verify image URLs are absolute, not relative

## 🎯 **Next Steps**

1. **Start with Assam** (already partially configured)
2. **Add Manipur sources** (high priority)
3. **Add remaining Northeast states**
4. **Set up automated scraping schedule**
5. **Monitor and maintain selectors**

Remember: CSS selectors can change when websites update, so you'll need to monitor and update them periodically!
