#!/usr/bin/env node

/**
 * Scheduler Test Script
 * 
 * Tests the automated scraper scheduler functionality
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const ScraperScheduler = require('../services/scraperScheduler');

async function testScheduler() {
  console.log('🧪 Testing Automated Scraper Scheduler');
  console.log('=' .repeat(50));
  
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
    
    // Create scheduler instance
    const scheduler = new ScraperScheduler();
    
    // Test 1: Check initial configuration
    console.log('\n📋 Test 1: Configuration');
    const stats = scheduler.getStats();
    console.log(`   Sources per cycle: ${stats.config.sourcesPerCycle}`);
    console.log(`   Request delay: ${stats.config.requestDelay}ms`);
    console.log(`   Cleanup days: ${stats.config.cleanupDays}`);
    console.log(`   Next cycle sources: ${stats.nextCycleSources.join(', ')}`);
    
    // Test 2: Run a manual cycle
    console.log('\n🔧 Test 2: Manual Cycle');
    console.log('Running a test scraping cycle...');
    
    const startTime = Date.now();
    await scheduler.runManualCycle();
    const endTime = Date.now();
    
    // Test 3: Check results
    console.log('\n📊 Test 3: Results');
    const finalStats = scheduler.getStats();
    console.log(`   Cycles completed: ${finalStats.totalCycles}`);
    console.log(`   Articles scraped: ${finalStats.totalArticlesScraped}`);
    console.log(`   Articles inserted: ${finalStats.totalArticlesInserted}`);
    console.log(`   Articles removed: ${finalStats.totalArticlesRemoved}`);
    console.log(`   Cycle time: ${((endTime - startTime) / 1000).toFixed(1)}s`);
    console.log(`   Average cycle time: ${(finalStats.averageRunTime / 1000).toFixed(1)}s`);
    
    // Test 4: Database verification
    console.log('\n🗄️ Test 4: Database Verification');
    const Article = require('../articleModel');
    const totalArticles = await Article.countDocuments();
    const recentArticles = await Article.countDocuments({
      scrapedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });
    
    console.log(`   Total articles in DB: ${totalArticles}`);
    console.log(`   Recent articles (last hour): ${recentArticles}`);
    
    // Test 5: Source health check
    console.log('\n🏥 Test 5: Source Health Check');
    const successRate = finalStats.totalCycles > 0 ? 
      (finalStats.totalArticlesInserted / Math.max(finalStats.totalArticlesScraped, 1)) * 100 : 0;
    
    console.log(`   Success rate: ${successRate.toFixed(1)}%`);
    
    if (successRate > 80) {
      console.log('   ✅ Excellent health');
    } else if (successRate > 60) {
      console.log('   ⚠️ Good health');
    } else {
      console.log('   ❌ Poor health - check source configurations');
    }
    
    console.log('\n🎉 Scheduler test completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start your server: npm run dev');
    console.log('   2. Check scheduler status: npm run scheduler:status');
    console.log('   3. Monitor logs for automated cycles');
    
  } catch (error) {
    console.error('❌ Scheduler test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check MongoDB connection');
    console.error('   2. Verify .env configuration');
    console.error('   3. Ensure all dependencies are installed');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  testScheduler()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test crashed:', error);
      process.exit(1);
    });
}

module.exports = testScheduler;