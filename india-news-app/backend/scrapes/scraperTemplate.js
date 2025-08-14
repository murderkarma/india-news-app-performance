 const axios = require('axios');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const Article = require('../articleModel');
const { generateArticleContent } = require('../utils/aiUtils');
const { deduplicateStateArticles, generateContentHash, checkStateArticlesInDatabase } = require('../utils/stateDeduplication');
const { batchAnalyzeGeographicRelevance } = require('../utils/geographicRelevance');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// STATE CONFIGURATION TEMPLATE
// Add your sources here as you find them and test their selectors
const STATE_CONFIGS = {
  'Assam': {
    sources: [
      {
        name: 'Northeast Now',
        url: 'https://nenow.in/north-east-news/assam',
        selectors: {
          articles: 'article.post',
          title: 'h2.entry-title a',
          link: 'h2.entry-title a',
          image: 'figure.post-thumbnail img',
          summary: 'div.entry-summary p'
        },
        fallbackImage: null
      },
      {
        name: 'The Assam Tribune',
        url: 'https://assamtribune.com/assam',
        selectors: {
          articles: 'div.hocal-post-item',
          title: 'h2.hocal-title',
          link: 'a',
          image: 'div.hocal-featured-image img',
          summary: 'div.hocal-excerpt'
        },
        fallbackImage: 'https://assamtribune.com/sites/all/themes/at/images/logo.png'
      },
      {
        name: 'Sentinel Assam',
        url: 'https://www.sentinelassam.com/north-east-india-news/assam-news',
        selectors: {
          articles: 'div.four-col-m_story-card-wrapper__1e8p0',
          title: 'h6[class*="headline"]',
          link: 'a[href*="/north-east-india-news/"]',
          image: 'img',
          summary: '' // No summary found in provided markup
        },
        fallbackImage: '../../../frontend/app/images/GPLUS ASSAM.jpeg'
      }
    ]
  },
  
  'Manipur': {
    sources: [
      {
        name: 'Northeast Today – Imphal Free Press',
        url: 'https://northeasttoday.in/tag/imphal-free-press/',
        selectors: {
          articles: 'article',
          title: 'h2.w-post-elm.post_title a, h3 a, h4 a',
          link: 'h2.w-post-elm.post_title a, h3 a, h4 a',
          image: 'img',
          summary: ''
        },
        fallbackImage: 'https://northeasttoday.in/wp-content/uploads/2020/03/NET-Logo.png'
      },
      {
        name: 'The Frontier Manipur',
        url: 'https://thefrontiermanipur.com/category/manipur/',
        selectors: {
          articles: 'div.listing-item',
          title: 'p.title a.post-title',
          link: 'p.title a.post-title',
          image: 'img',
          summary: ''
        },
        fallbackImage: 'https://thefrontiermanipur.com/wp-content/uploads/2020/03/logo.png'
      },
      {
        name: 'Northeast Today - manipur',
        url: 'https://northeasttoday.in/tag/manipur/',
        selectors: {
          articles: 'article',
          title: 'h2.w-post-elm.post_title a, h3 a, h4 a',
          link: 'h2.w-post-elm.post_title a, h3 a, h4 a',
          image: 'img',
          summary: ''
        },
        fallbackImage: 'https://northeasttoday.in/wp-content/uploads/2020/03/NET-Logo.png'
      }
    ]
  },
  
  'Meghalaya': {
    sources: [
      {
        name: 'The Shillong Times',
        url: 'https://theshillongtimes.com/meghalaya/',
        selectors: {
          articles: 'div.td_module_flex',
          title: 'h3.entry-title a',
          link: 'h3.entry-title a',
          image: 'span.entry-thumb',
          summary: 'div.td-excerpt'
        },
        fallbackImage: 'https://theshillongtimes.com/wp-content/uploads/2020/03/logo.png'
      },
      {
        name: 'Meghalaya Monitor',
        url: 'https://meghalayamonitor.com/category/state/',
        selectors: {
          articles: 'li.post-item',
          title: 'a',
          link: 'a',
          image: 'img.wp-post-image',
          summary: ''
        },
        fallbackImage: 'https://meghalayamonitor.com/wp-content/uploads/2020/03/logo.png'
      }
    ]
  },
  
  'Mizoram': {
    sources: [
      // Vanglaini removed - uses dynamic content loading
    ]
  },
  
  'Nagaland': {
    sources: [
      {
        name: 'Nagaland Post',
        url: 'https://nagalandpost.com/category/nagaland-news/',
        selectors: {
          articles: 'li.menu-item',
          title: 'a',
          link: 'a',
          image: '',
          summary: ''
        },
        fallbackImage: null
      },
      {
        name: 'The Morung Express',
        url: 'https://morungexpress.com/category/nagaland',
        selectors: {
          articles: 'span.field-content',
          title: '.post-title a',
          link: '.post-title a',
          image: 'img',
          summary: ''
        },
        fallbackImage: 'https://morungexpress.com/sites/all/themes/morung/logo.png'
      },
      {
        name: 'Eastern Mirror (Nagaland)',
        url: 'https://www.easternmirrornagaland.com/nagaland',
        selectors: {
          articles: 'div.grid',
          title: 'a',
          link: 'a',
          image: 'img',
          summary: ''
        },
        fallbackImage: null
      }
    ]
  },
  
  'Arunachal Pradesh': {
    sources: [
      {
        name: 'The Arunachal Times',
        url: 'https://arunachaltimes.in/index.php/category/state-news/',
        selectors: {
          articles: 'div.td_module_16',
          title: 'h3.entry-title a',
          link: 'h3.entry-title a',
          image: 'img.entry-thumb',
          summary: 'div.td-excerpt'
        },
        fallbackImage: 'https://arunachaltimes.in/wp-content/uploads/2020/03/logo.png'
      },
      {
        name: 'Arunachal24.in',
        url: 'https://arunachal24.in/category/arunachal-pradesh/',
        selectors: {
          articles: 'li.post-item.tie-standard',
          title: 'h2.post-title a',
          link: 'h2.post-title a',
          image: 'img.wp-post-image',
          summary: ''
        },
        fallbackImage: 'https://arunachal24.in/wp-content/uploads/2020/03/logo.png'
      }
    ]
  },
  
  'Tripura': {
    sources: [
      {
        name: 'Tripura Times',
        url: 'https://tripuratimes.com/News/Tripura-News-4.html',
        selectors: {
          articles: 'div.col-lg-3',
          title: 'a[href*="/ttimes/"]',
          link: 'a[href*="/ttimes/"]',
          image: 'img',
          summary: ''
        },
        fallbackImage: 'https://tripuratimes.com/images/logo.png'
      },
      {
        name: 'Tripura Today',
        url: 'https://tripuratoday.com/category?v=1',
        selectors: {
          articles: 'div.post-item-wrap',
          title: 'h3.post-title a',
          link: 'h3.post-title a',
          image: 'img',
          summary: 'div.post-summary'
        },
        fallbackImage: 'https://tripuratoday.com/wp-content/uploads/2021/05/tripura_today_logo.png'
      }
    ]
  },
  
  'Sikkim': {
    sources: [
      // Sikkim Express removed - uses dynamic content loading
    ]
  }
};

/**
 * Test a single source configuration
 * Use this to test your CSS selectors before adding them to the main config
 */
async function testSource(stateName, sourceConfig) {
  try {
    console.log(`🧪 Testing ${sourceConfig.name} for ${stateName}...`);
    console.log(`📍 URL: ${sourceConfig.url || sourceConfig.base_url}`);
    
    const response = await axios.get(sourceConfig.url || sourceConfig.base_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    console.log(`✅ Page loaded successfully`);
    
    // Test selectors
    const articleElements = $(sourceConfig.selectors ? sourceConfig.selectors.articles : sourceConfig.article_selector);
    console.log(`📰 Found ${articleElements.length} article containers`);
    
    if (articleElements.length === 0) {
      console.log(`❌ No articles found with selector: ${sourceConfig.selectors ? sourceConfig.selectors.articles : sourceConfig.article_selector}`);
      return [];
    }

    const articles = [];
    articleElements.each((index, element) => {
      if (index >= 3) return false; // Test only first 3
      
      const $element = $(element);
      const title = sourceConfig.selectors ? $element.find(sourceConfig.selectors.title).text().trim() : $element.find(sourceConfig.title_selector).text().trim();
      const link = sourceConfig.selectors ? $element.find(sourceConfig.selectors.link).attr('href') : $element.find(sourceConfig.url_selector).attr('href');
      const image = sourceConfig.selectors ? ($element.find(sourceConfig.selectors.image).attr('src') || 
                   $element.find(sourceConfig.selectors.image).attr('data-src')) : null;
      const summary = sourceConfig.selectors ? $element.find(sourceConfig.selectors.summary).text().trim() : '';

      console.log(`\n📄 Article ${index + 1}:`);
      console.log(`   Title: ${title || 'NOT FOUND'}`);
      console.log(`   Link: ${link || 'NOT FOUND'}`);
      console.log(`   Image: ${image || 'NOT FOUND'}`);
      console.log(`   Summary: ${summary ? summary.substring(0, 100) + '...' : 'NOT FOUND'}`);

      if (title && link) {
        articles.push({
          title,
          link: link.startsWith('http') ? link : `${new URL(sourceConfig.url || sourceConfig.base_url).origin}${link}`,
          image: image && image.startsWith('http') ? image : 
                 image ? `${new URL(sourceConfig.url || sourceConfig.base_url).origin}${image}` : null,
          summary: summary || '',
          state: stateName,
          source: sourceConfig.name
        });
      }
    });

    console.log(`\n✅ Successfully extracted ${articles.length} articles`);
    return articles;

  } catch (error) {
    console.error(`❌ Test failed:`, error.message);
    return [];
  }
}

/**
 * Scrape articles from a working source configuration with AI enhancement
 */
async function scrapeSource(state, sourceConfig) {
  try {
    console.log(`🔍 Scraping ${sourceConfig.name} for ${state}...`);
    
    const response = await axios.get(sourceConfig.url || sourceConfig.base_url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const articles = [];

    const articleSelector = sourceConfig.selectors ? sourceConfig.selectors.articles : sourceConfig.article_selector;
    const titleSelector = sourceConfig.selectors ? sourceConfig.selectors.title : sourceConfig.title_selector;
    const urlSelector = sourceConfig.selectors ? sourceConfig.selectors.link : sourceConfig.url_selector;

    $(articleSelector).each((index, element) => {
      if (index >= 10) return false; // Limit to 10 articles per source

      const $element = $(element);
      const title = $element.find(titleSelector).text().trim();
      const link = $element.find(urlSelector).attr('href');
      let image = sourceConfig.selectors && sourceConfig.selectors.image
        ? ($element.find(sourceConfig.selectors.image).attr('data-src') ||
           $element.find(sourceConfig.selectors.image).attr('src') ||
           $element.find(sourceConfig.selectors.image).attr('data-lazy-src'))
        : null;
      
      // Filter out placeholder/lazy-loading SVGs and invalid images
      if (image && (
        image.includes('data:image/svg+xml') ||
        image.includes('data:image/gif;base64') ||
        image.includes('placeholder') ||
        image.includes('lazy') ||
        image.includes('R0lGODlhAQABAAD') || // 1x1 transparent GIF
        image.trim() === '' ||
        image.length < 10
      )) {
        image = null;
      }
      
      // Skip fallback images to avoid 404 errors - better to have no image than broken image
      // if (!image && sourceConfig.fallbackImage) {
      //   image = sourceConfig.fallbackImage;
      // }
      const summary = sourceConfig.selectors ? $element.find(sourceConfig.selectors.summary).text().trim() : '';

      if (title && link) {
        articles.push({
          title,
          link: link.startsWith('http') ? link : `${new URL(sourceConfig.url || sourceConfig.base_url).origin}${link}`,
          image: image && image.startsWith('http') ? image :
                 image ? `${new URL(sourceConfig.url || sourceConfig.base_url).origin}${image}` : null,
          summary: summary || '',
          state,
          source: sourceConfig.name,
          scrapedAt: new Date()
        });
      }
    });

    console.log(`✅ Found ${articles.length} articles from ${sourceConfig.name}`);
    
    // AI Enhancement: Generate punchlines and summaries for all articles
    if (articles.length > 0) {
      console.log(`🤖 Enhancing ${articles.length} articles with AI...`);
      
      for (let i = 0; i < articles.length; i++) {
        try {
          const article = articles[i];
          console.log(`🔄 AI enhancing article ${i + 1}/${articles.length}: "${article.title.substring(0, 50)}..."`);
          
          const aiContent = await generateArticleContent({
            title: article.title,
            body: article.summary,
            source: article.source,
            state: article.state
          });
          
          // Add AI-generated content to the article
          articles[i] = {
            ...article,
            aiPunchline: aiContent.punchline,
            aiSummary: aiContent.summary,
            aiGenerated: true,
            aiProcessedAt: new Date()
          };
          
          console.log(`✅ AI enhanced: "${aiContent.punchline}"`);
          
          // Small delay to respect API rate limits
          if (i < articles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (aiError) {
          console.error(`🤖 AI enhancement failed for article ${i + 1}:`, aiError.message);
          // Keep the article but mark as not AI-enhanced
          articles[i] = {
            ...articles[i],
            aiGenerated: false,
            aiError: aiError.message
          };
        }
      }
      
      console.log(`🎯 AI enhancement completed for ${sourceConfig.name}`);
    }
    
    return articles;

  } catch (error) {
    console.error(`❌ Failed to scrape ${sourceConfig.name} for ${state}:`, error.message);
    return [];
  }
}

/**
 * Scrape all configured sources for a state
 */
async function scrapeState(stateName) {
  const stateConfig = STATE_CONFIGS[stateName];
  if (!stateConfig || stateConfig.sources.length === 0) {
    console.log(`⚠️ No sources configured for ${stateName}`);
    return [];
  }

  console.log(`🌟 Starting scraping for ${stateName}...`);
  const allArticles = [];

  for (const sourceConfig of stateConfig.sources) {
    const articles = await scrapeSource(stateName, sourceConfig);
    allArticles.push(...articles);
    
    // Small delay between sources
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return allArticles;
}

/**
 * Scrape state configuration and save to database (used by scheduler)
 */
async function scrapeStateConfig(stateName, stateConfig) {
  try {
    console.log(`🚀 Starting automated scraping for ${stateName}...`);
    
    if (!stateConfig || !stateConfig.sources || stateConfig.sources.length === 0) {
      return {
        success: false,
        error: `No sources configured for ${stateName}`,
        total: 0,
        inserted: 0
      };
    }

    const allArticles = [];

    // Scrape all sources for this state
    for (const sourceConfig of stateConfig.sources) {
      const articles = await scrapeSource(stateName, sourceConfig);
      allArticles.push(...articles);
      
      // Small delay between sources to be polite
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    if (allArticles.length === 0) {
      console.log(`📭 No articles found for ${stateName}`);
      return {
        success: true,
        total: 0,
        inserted: 0
      };
    }

    // Step 1: Geographic relevance validation
    console.log(`🌍 Validating geographic relevance for ${allArticles.length} articles...`);
    const geoAnalysisResults = await batchAnalyzeGeographicRelevance(allArticles, 3);
    
    const geographicallyRelevantArticles = geoAnalysisResults
      .filter(result => result.shouldInclude)
      .map(result => result.article);
    
    const geoFilteredCount = allArticles.length - geographicallyRelevantArticles.length;
    
    console.log(`✅ Geographic validation complete:`);
    console.log(`   Original articles: ${allArticles.length}`);
    console.log(`   Geographically relevant: ${geographicallyRelevantArticles.length}`);
    console.log(`   Filtered out (wrong state/regional): ${geoFilteredCount}`);
    
    if (geoFilteredCount > 0) {
      const filteredArticles = geoAnalysisResults.filter(result => !result.shouldInclude);
      console.log(`📍 Geographic filtering details:`);
      filteredArticles.forEach(result => {
        if (result.analysis.recommendedState === 'Regional') {
          console.log(`   🌐 Regional event: "${result.article.title.substring(0, 60)}..."`);
        } else {
          console.log(`   🔄 Reassigned to ${result.analysis.recommendedState}: "${result.article.title.substring(0, 60)}..."`);
        }
      });
    }

    // Step 2: Remove duplicates within the same state from different sources
    console.log(`🔄 Removing duplicates within ${stateName} from ${geographicallyRelevantArticles.length} articles...`);
    const deduplicationResult = deduplicateStateArticles(geographicallyRelevantArticles, {
      similarityThreshold: 0.85,
      logDuplicates: true
    });
    
    console.log(`✅ State deduplication complete:`);
    console.log(`   Geographic articles: ${deduplicationResult.originalCount}`);
    console.log(`   Unique articles: ${deduplicationResult.uniqueCount}`);
    console.log(`   Duplicates removed: ${deduplicationResult.duplicateCount}`);
    
    const uniqueStateArticles = deduplicationResult.uniqueArticles;
    
    // Add contentHash to each article for database efficiency
    uniqueStateArticles.forEach(article => {
      article.contentHash = generateContentHash(article);
    });

    // Step 3: Check against existing database articles
    console.log(`🔍 Checking ${uniqueStateArticles.length} unique articles against database...`);
    const dbCheckResults = await checkStateArticlesInDatabase(uniqueStateArticles, stateName, Article, {
      similarityThreshold: 0.85,
      dayLimit: 7
    });
    
    const newArticles = dbCheckResults
      .filter(result => !result.isDuplicate)
      .map(result => result.article);
    
    const dbDuplicates = dbCheckResults.filter(result => result.isDuplicate);
    
    if (dbDuplicates.length > 0) {
      console.log(`🔁 Found ${dbDuplicates.length} articles already in database`);
    }
    
    if (newArticles.length === 0) {
      console.log(`🔁 All articles already exist in database or are duplicates`);
      return {
        success: true,
        total: allArticles.length,
        geographicallyRelevant: geographicallyRelevantArticles.length,
        geoFiltered: geoFilteredCount,
        unique: uniqueStateArticles.length,
        duplicatesRemoved: deduplicationResult.duplicateCount + dbDuplicates.length,
        inserted: 0,
        articles: 0
      };
    }

    // Save new articles to database
    console.log(`💾 Saving ${newArticles.length} new AI-enhanced articles to database...`);
    const insertedArticles = await Article.insertMany(newArticles);
    
    console.log(`✅ Successfully saved ${insertedArticles.length} articles for ${stateName}`);
    console.log(`🤖 All articles include AI-generated punchlines and summaries!`);
    console.log(`📊 Processing Summary:`);
    console.log(`   Total scraped: ${allArticles.length}`);
    console.log(`   Geographic filtering: ${geoFilteredCount} removed`);
    console.log(`   Geographically relevant: ${geographicallyRelevantArticles.length}`);
    console.log(`   State duplicates removed: ${deduplicationResult.duplicateCount}`);
    console.log(`   Database duplicates found: ${dbDuplicates.length}`);
    console.log(`   New articles saved: ${insertedArticles.length}`);
    
    return {
      success: true,
      total: allArticles.length,
      geographicallyRelevant: geographicallyRelevantArticles.length,
      geoFiltered: geoFilteredCount,
      unique: uniqueStateArticles.length,
      duplicatesRemoved: deduplicationResult.duplicateCount + dbDuplicates.length,
      inserted: insertedArticles.length,
      articles: insertedArticles.length
    };

  } catch (error) {
    console.error(`❌ Failed to scrape and save ${stateName}:`, error.message);
    return {
      success: false,
      error: error.message,
      total: 0,
      inserted: 0
    };
  }
}

// CLI interface for testing
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'test') {
    // Test a specific source: node scraperTemplate.js test Assam EastMojo
    const stateName = args[1];
    const sourceName = args[2];
    
    if (!stateName || !sourceName) {
      console.log('Usage: node scraperTemplate.js test <StateName> <SourceName>');
      process.exit(1);
    }
    
    const stateConfig = STATE_CONFIGS[stateName];
    if (!stateConfig) {
      console.log(`❌ State ${stateName} not found in configuration`);
      process.exit(1);
    }
    
    const sourceConfig = stateConfig.sources.find(s => s.name === sourceName);
    if (!sourceConfig) {
      console.log(`❌ Source ${sourceName} not found for ${stateName}`);
      process.exit(1);
    }
    
    testSource(stateName, sourceConfig)
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Test failed:', error.message);
        process.exit(1);
      });
      
  } else if (command === 'scrape') {
    // Scrape a specific state: node scraperTemplate.js scrape Assam
    const stateName = args[1];
    
    if (!stateName) {
      console.log('Usage: node scraperTemplate.js scrape <StateName>');
      process.exit(1);
    }
    
    scrapeState(stateName)
      .then(articles => {
        console.log(`✅ Scraped ${articles.length} articles for ${stateName}`);
        process.exit(0);
      })
      .catch(error => {
        console.error('Scraping failed:', error.message);
        process.exit(1);
      });
      
  } else {
    console.log('Available commands:');
    console.log('  test <StateName> <SourceName> - Test CSS selectors for a source');
    console.log('  scrape <StateName> - Scrape all configured sources for a state');
    console.log('');
    console.log('Examples:');
    console.log('  node scraperTemplate.js test Assam EastMojo');
    console.log('  node scraperTemplate.js scrape Assam');
  }
}

module.exports = {
  testSource,
  scrapeSource,
  scrapeState,
  scrapeStateConfig,
  STATE_CONFIGS
};