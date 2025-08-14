const axios = require('axios');
const cheerio = require('cheerio');
const Article = require('../articleModel.js');
const { batchGenerateContent, generateArticleContent } = require('../utils/aiUtils.js');

/**
 * Enhanced Assam news scraper with AI content generation
 * Scrapes news from multiple sources and generates punchy headlines + summaries
 */
async function scrapeAssamNews() {
  try {
    console.log('🦏 Starting Assam news scraping...');
    
    // Multiple news sources for Assam
    const sources = [
      {
        name: 'EastMojo',
        url: 'https://www.eastmojo.com/assam/',
        selector: 'article'
      },
      // Add more sources as needed
    ];

    let allArticles = [];

    // Scrape from all sources
    for (const source of sources) {
      console.log(`📰 Scraping ${source.name}...`);
      const articles = await scrapeSource(source);
      allArticles.push(...articles);
    }

    console.log(`📊 Scraped ${allArticles.length} raw articles`);

    if (allArticles.length === 0) {
      console.log('⚠️ No articles found to process');
      return { total: 0, inserted: 0, aiProcessed: 0 };
    }

    // Generate AI content for all articles
    console.log('🤖 Generating AI content...');
    const aiEnhancedArticles = await batchGenerateContent(allArticles, 3);
    
    const successfullyProcessed = aiEnhancedArticles.filter(article => article.aiGenerated);
    console.log(`✅ Successfully AI-processed ${successfullyProcessed.length}/${allArticles.length} articles`);

    // Save to MongoDB
    console.log('💾 Saving to database...');
    let newInserts = 0;
    let updates = 0;

    for (const article of aiEnhancedArticles) {
      try {
        const result = await Article.findOneAndUpdate(
          { link: article.link },
          {
            title: article.title, // This is now the AI-generated punchline
            summary: article.summary, // AI-generated summary
            image: article.image,
            link: article.link,
            state: article.state,
            originalTitle: article.originalTitle,
            aiGenerated: article.aiGenerated,
            processedAt: article.processedAt,
            source: article.source || 'Unknown'
          },
          { 
            upsert: true, 
            new: false, 
            rawResult: true 
          }
        );

        if (!result.lastErrorObject.updatedExisting) {
          newInserts++;
        } else {
          updates++;
        }
      } catch (saveError) {
        console.error(`❌ Failed to save article: ${article.title}`, saveError.message);
      }
    }

    const results = {
      total: allArticles.length,
      inserted: newInserts,
      updated: updates,
      aiProcessed: successfullyProcessed.length,
      articles: aiEnhancedArticles
    };

    console.log('🎉 Assam scraping completed:', results);
    return results;

  } catch (error) {
    console.error('💥 Error in Assam scraper:', error.message);
    return { total: 0, inserted: 0, aiProcessed: 0, error: error.message };
  }
}

/**
 * Scrape articles from a specific source
 */
async function scrapeSource(source) {
  try {
    const { data } = await axios.get(source.url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const $ = cheerio.load(data);
    const articles = [];

    $(source.selector).each((i, el) => {
      try {
        // Extract article data based on source structure
        let link, image, title, body = '';

        if (source.name === 'EastMojo') {
          link = $(el).find('figure.post-thumbnail a').attr('href') ||
                 $(el).find('.entry-title a').attr('href');
          
          // Enhanced image extraction with multiple fallbacks
          image = $(el).find('figure.post-thumbnail img').attr('src') ||
                  $(el).find('figure.post-thumbnail img').attr('data-src') ||
                  $(el).find('img').first().attr('src') ||
                  $(el).find('img').first().attr('data-src') ||
                  $(el).find('.wp-post-image').attr('src') ||
                  $(el).find('.attachment-post-thumbnail').attr('src');
          
          // Ensure image URL is absolute
          if (image && !image.startsWith('http')) {
            image = image.startsWith('//') ? `https:${image}` : `https://www.eastmojo.com${image}`;
          }
          
          title = $(el).find('.entry-title a').text().trim() ||
                  $(el).find('h2 a').text().trim();
          body = $(el).find('.entry-summary').text().trim() ||
                 $(el).find('.excerpt').text().trim();
        }

        // Validate required fields and log image extraction
        if (title && link && title.length > 10) {
          const articleData = {
            title: title,
            link: link.startsWith('http') ? link : `https://www.eastmojo.com${link}`,
            image: image || null, // Ensure null instead of undefined
            body: body,
            state: 'Assam',
            source: source.name,
            scrapedAt: new Date()
          };
          
          // Debug logging for image extraction
          if (process.env.NODE_ENV === 'development') {
            console.log(`📸 Article: "${title.substring(0, 50)}..." - Image: ${image ? 'Found' : 'Missing'}`);
          }
          
          articles.push(articleData);
        }
      } catch (elementError) {
        console.warn(`⚠️ Error processing element from ${source.name}:`, elementError.message);
      }
    });

    console.log(`📄 Found ${articles.length} articles from ${source.name}`);
    return articles;

  } catch (error) {
    console.error(`❌ Error scraping ${source.name}:`, error.message);
    return [];
  }
}

/**
 * Process a single article with AI enhancement
 * Useful for testing or processing individual articles
 */
async function processSingleArticle(articleData) {
  try {
    console.log('🔄 Processing single article:', articleData.title);
    
    const aiContent = await generateArticleContent(articleData);
    
    const enhancedArticle = {
      ...articleData,
      title: aiContent.punchline,
      summary: aiContent.summary,
      originalTitle: articleData.title,
      aiGenerated: true,
      processedAt: new Date()
    };

    // Save to database
    const result = await Article.findOneAndUpdate(
      { link: enhancedArticle.link },
      enhancedArticle,
      { upsert: true, new: true }
    );

    console.log('✅ Article processed and saved:', result.title);
    return result;

  } catch (error) {
    console.error('❌ Error processing single article:', error.message);
    throw error;
  }
}

// Export functions
module.exports = {
  scrapeAssamNews,
  processSingleArticle,
  scrapeSource
};

// Example usage when run directly
if (require.main === module) {
  // Test the scraper
  scrapeAssamNews()
    .then(results => {
      console.log('🏁 Scraping completed:', results);
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Scraping failed:', error);
      process.exit(1);
    });
}