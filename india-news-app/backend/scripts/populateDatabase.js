#!/usr/bin/env node

/**
 * Database Population Script for India News App
 * 
 * This script provides multiple ways to populate your MongoDB database with articles:
 * 1. ScraperTemplate system (21 Northeast sources with 95.2% success rate)
 * 2. EastMojo scraper system (8 state-specific endpoints)
 * 3. Combined approach for maximum coverage
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const axios = require('axios');

// Import scraping functions
const { scrapeAllStates } = require('../scrapes/scraperTemplate');
const scrapeEastMojo = require('../scrapes/eastmojoScraper');
const Article = require('../articleModel');

const BASE_URL = 'http://localhost:8080';

class DatabasePopulator {
  constructor() {
    this.stats = {
      scraperTemplate: { total: 0, inserted: 0, sources: 0 },
      eastMojo: { total: 0, inserted: 0, sources: 0 },
      overall: { total: 0, inserted: 0, duplicates: 0 }
    };
  }

  async connectDB() {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      process.exit(1);
    }
  }

  async checkServerStatus() {
    try {
      const response = await axios.get(`${BASE_URL}/api/news/ping`);
      console.log('✅ Server is running');
      return true;
    } catch (error) {
      console.log('⚠️ Server not running. Using direct database access.');
      return false;
    }
  }

  /**
   * Method 1: Use ScraperTemplate system (21 sources, 95.2% success rate)
   */
  async populateWithScraperTemplate() {
    console.log('\n🕷️ Method 1: ScraperTemplate System (21 Northeast Sources)');
    console.log('=' .repeat(60));

    try {
      const results = await scrapeAllStates();
      
      for (const [state, result] of Object.entries(results)) {
        if (result.success) {
          this.stats.scraperTemplate.total += result.total;
          this.stats.scraperTemplate.inserted += result.inserted;
          this.stats.scraperTemplate.sources++;
          
          console.log(`✅ ${state}: ${result.inserted}/${result.total} new articles`);
        } else {
          console.log(`❌ ${state}: Failed - ${result.error}`);
        }
      }

      console.log(`\n📊 ScraperTemplate Results:`);
      console.log(`   Sources processed: ${this.stats.scraperTemplate.sources}/21`);
      console.log(`   Total articles found: ${this.stats.scraperTemplate.total}`);
      console.log(`   New articles inserted: ${this.stats.scraperTemplate.inserted}`);

    } catch (error) {
      console.error('❌ ScraperTemplate failed:', error.message);
    }
  }

  /**
   * Method 2: Use EastMojo API endpoints
   */
  async populateWithEastMojo(useAPI = true) {
    console.log('\n🕷️ Method 2: EastMojo System (8 State Endpoints)');
    console.log('=' .repeat(60));

    const states = ['assam', 'manipur', 'meghalaya', 'arunachal', 'mizoram', 'nagaland', 'sikkim', 'tripura'];
    
    for (const state of states) {
      try {
        let result;
        
        if (useAPI) {
          // Use API endpoint
          const response = await axios.get(`${BASE_URL}/api/news/scrape/${state}`);
          result = response.data;
          console.log(`✅ ${state}: ${result.inserted} new articles (API)`);
        } else {
          // Direct scraping
          const urlMap = {
            assam: 'https://www.eastmojo.com/tag/assam/',
            manipur: 'https://www.eastmojo.com/tag/manipur/',
            meghalaya: 'https://www.eastmojo.com/tag/meghalaya/',
            arunachal: 'https://www.eastmojo.com/tag/arunachal-pradesh/',
            mizoram: 'https://www.eastmojo.com/tag/mizoram/',
            nagaland: 'https://www.eastmojo.com/tag/nagaland/',
            sikkim: 'https://www.eastmojo.com/tag/sikkim/',
            tripura: 'https://www.eastmojo.com/tag/tripura/',
          };
          
          result = await scrapeEastMojo(state, urlMap[state]);
          console.log(`✅ ${state}: ${result.inserted}/${result.total} new articles (Direct)`);
        }
        
        this.stats.eastMojo.total += result.total || result.inserted;
        this.stats.eastMojo.inserted += result.inserted;
        this.stats.eastMojo.sources++;
        
      } catch (error) {
        console.log(`❌ ${state}: Failed - ${error.message}`);
      }
    }

    console.log(`\n📊 EastMojo Results:`);
    console.log(`   Sources processed: ${this.stats.eastMojo.sources}/8`);
    console.log(`   Total articles found: ${this.stats.eastMojo.total}`);
    console.log(`   New articles inserted: ${this.stats.eastMojo.inserted}`);
  }

  /**
   * Method 3: Combined approach for maximum coverage
   */
  async populateWithBothSystems() {
    console.log('\n🚀 Method 3: Combined Approach (Maximum Coverage)');
    console.log('=' .repeat(60));

    const serverRunning = await this.checkServerStatus();
    
    // First run ScraperTemplate (more sources, better coverage)
    await this.populateWithScraperTemplate();
    
    // Then run EastMojo for additional coverage
    await this.populateWithEastMojo(serverRunning);
    
    // Calculate overall stats
    this.stats.overall.total = this.stats.scraperTemplate.total + this.stats.eastMojo.total;
    this.stats.overall.inserted = this.stats.scraperTemplate.inserted + this.stats.eastMojo.inserted;
  }

  /**
   * Get current database statistics
   */
  async getDatabaseStats() {
    try {
      const totalArticles = await Article.countDocuments();
      const aiEnhanced = await Article.countDocuments({ aiGenerated: true });
      const byState = await Article.aggregate([
        { $group: { _id: '$state', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      console.log('\n📊 Current Database Statistics:');
      console.log('=' .repeat(40));
      console.log(`Total Articles: ${totalArticles}`);
      console.log(`AI Enhanced: ${aiEnhanced} (${((aiEnhanced/totalArticles)*100).toFixed(1)}%)`);
      console.log('\nBy State:');
      byState.forEach(state => {
        console.log(`  ${state._id}: ${state.count} articles`);
      });

    } catch (error) {
      console.error('❌ Failed to get database stats:', error.message);
    }
  }

  /**
   * Enhance articles with AI
   */
  async enhanceWithAI() {
    console.log('\n🤖 Enhancing Articles with AI...');
    console.log('=' .repeat(40));

    try {
      const serverRunning = await this.checkServerStatus();
      
      if (serverRunning) {
        const response = await axios.post(`${BASE_URL}/api/news/enhance-ai-all?limit=100`);
        console.log(`✅ ${response.data.message}`);
      } else {
        console.log('⚠️ Server not running. Skipping AI enhancement.');
        console.log('   Start server and run: POST /api/news/enhance-ai-all');
      }
    } catch (error) {
      console.error('❌ AI enhancement failed:', error.message);
    }
  }

  /**
   * Main execution method
   */
  async run(method = 'combined') {
    console.log('🚀 India News App - Database Population Script');
    console.log('=' .repeat(50));
    
    await this.connectDB();
    
    // Show initial stats
    await this.getDatabaseStats();
    
    switch (method) {
      case 'template':
        await this.populateWithScraperTemplate();
        break;
      case 'eastmojo':
        const serverRunning = await this.checkServerStatus();
        await this.populateWithEastMojo(serverRunning);
        break;
      case 'combined':
      default:
        await this.populateWithBothSystems();
        break;
    }

    // Show final stats
    await this.getDatabaseStats();
    
    // Enhance with AI
    await this.enhanceWithAI();
    
    console.log('\n🎉 Database population complete!');
    console.log('\nFinal Summary:');
    console.log(`  Total new articles: ${this.stats.overall.inserted}`);
    console.log(`  ScraperTemplate: ${this.stats.scraperTemplate.inserted} articles`);
    console.log(`  EastMojo: ${this.stats.eastMojo.inserted} articles`);
    
    await mongoose.disconnect();
  }
}

// CLI interface
if (require.main === module) {
  const method = process.argv[2] || 'combined';
  
  if (!['template', 'eastmojo', 'combined'].includes(method)) {
    console.log('Usage: node populateDatabase.js [template|eastmojo|combined]');
    console.log('  template  - Use only ScraperTemplate (21 sources)');
    console.log('  eastmojo  - Use only EastMojo (8 sources)');
    console.log('  combined  - Use both systems (default)');
    process.exit(1);
  }
  
  const populator = new DatabasePopulator();
  populator.run(method)
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Script failed:', error.message);
      process.exit(1);
    });
}

module.exports = DatabasePopulator;