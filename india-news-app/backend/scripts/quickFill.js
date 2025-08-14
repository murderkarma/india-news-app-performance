#!/usr/bin/env node

/**
 * Quick Database Fill Script
 * 
 * Simple one-command script to quickly populate your database
 * with articles from all available sources.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { scrapeState, STATE_CONFIGS } = require('../scrapes/scraperTemplate');
const mongoose = require('mongoose');
const Article = require('../articleModel');

// Function to scrape all states
async function scrapeAllStates() {
  const results = {};
  const states = Object.keys(STATE_CONFIGS);
  
  console.log(`📍 Scraping ${states.length} states...`);
  
  for (const state of states) {
    try {
      console.log(`\n🌟 Scraping ${state}...`);
      const articles = await scrapeState(state);
      
      if (articles.length > 0) {
        // Save articles to database
        const savedArticles = await Article.insertMany(articles);
        results[state] = {
          success: true,
          inserted: savedArticles.length
        };
        console.log(`✅ Found ${articles.length} articles from ${state}`);
      } else {
        results[state] = {
          success: false,
          inserted: 0
        };
        console.log(`⚠️ No articles found for ${state}`);
      }
      
      // Small delay between states
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`❌ Error scraping ${state}:`, error.message);
      results[state] = {
        success: false,
        inserted: 0
      };
    }
  }
  
  return results;
}

async function quickFill() {
  console.log('🚀 Quick Database Fill - Starting...');
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    // Clear existing articles
    await Article.deleteMany({});
    console.log('🗑️ Cleared existing articles');
    
    // Run the high-success-rate scrapers
    console.log('🕷️ Running ScraperTemplate (21 sources, 95.2% success rate)...');
    const results = await scrapeAllStates();
    
    let totalInserted = 0;
    let successfulSources = 0;
    
    for (const [state, result] of Object.entries(results)) {
      if (result.success) {
        totalInserted += result.inserted;
        successfulSources++;
        console.log(`✅ ${state}: +${result.inserted} new articles`);
      } else {
        console.log(`❌ ${state}: Failed`);
      }
    }
    
    console.log('\n🎉 Quick Fill Complete!');
    console.log(`📊 Results: ${totalInserted} new articles from ${successfulSources}/21 sources`);
    console.log('\n💡 Next steps:');
    console.log('   1. Start your server: npm run dev');
    console.log('   2. Enhance with AI: POST /api/news/enhance-ai-all');
    console.log('   3. View articles: GET /api/news/ne-popular');
    
  } catch (error) {
    console.error('❌ Quick fill failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  quickFill()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('💥 Script crashed:', error);
      process.exit(1);
    });
}

module.exports = quickFill;