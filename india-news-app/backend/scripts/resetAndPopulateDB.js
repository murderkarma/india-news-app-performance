const mongoose = require('mongoose');
const Article = require('../articleModel');
const { scrapeStateConfig, STATE_CONFIGS } = require('../scrapes/scraperTemplate');
require('dotenv').config();

// Color codes for better console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

async function clearDatabase() {
  try {
    log('🗑️  Clearing existing articles from database...', 'yellow');
    const deleteResult = await Article.deleteMany({});
    log(`✅ Cleared ${deleteResult.deletedCount} existing articles`, 'green');
    return deleteResult.deletedCount;
  } catch (error) {
    log(`❌ Error clearing database: ${error.message}`, 'red');
    throw error;
  }
}

async function populateWithFreshArticles() {
  const states = Object.keys(STATE_CONFIGS);
  const results = {
    totalArticles: 0,
    totalUnique: 0,
    totalDuplicatesRemoved: 0,
    successfulStates: 0,
    failedStates: 0,
    stateResults: {}
  };

  log(`\n🚀 Starting to populate database with articles from ${states.length} states...`, 'cyan');
  log('📝 All articles will include AI-generated punchlines and summaries', 'blue');
  log('🔄 Duplicate detection enabled within each state\n', 'blue');

  for (const state of states) {
    try {
      log(`\n📍 Processing ${state}...`, 'magenta');
      
      const stateResult = await scrapeStateConfig(state, STATE_CONFIGS[state]);
      
      if (stateResult.success && stateResult.articles > 0) {
        results.totalArticles += stateResult.total || 0;
        results.totalUnique += stateResult.unique || 0;
        results.totalDuplicatesRemoved += stateResult.duplicatesRemoved || 0;
        results.successfulStates++;
        results.stateResults[state] = {
          success: true,
          total: stateResult.total || 0,
          geographicallyRelevant: stateResult.geographicallyRelevant || 0,
          geoFiltered: stateResult.geoFiltered || 0,
          unique: stateResult.unique || 0,
          duplicatesRemoved: stateResult.duplicatesRemoved || 0,
          inserted: stateResult.inserted || 0
        };
        const geoInfo = stateResult.geoFiltered > 0 ? `, ${stateResult.geoFiltered} geo-filtered` : '';
        log(`✅ ${state}: ${stateResult.inserted} articles saved (${stateResult.duplicatesRemoved || 0} duplicates removed${geoInfo})`, 'green');
      } else {
        results.failedStates++;
        results.stateResults[state] = {
          success: false,
          error: stateResult.error || 'Unknown error',
          total: 0,
          geographicallyRelevant: 0,
          geoFiltered: 0,
          unique: 0,
          duplicatesRemoved: 0,
          inserted: 0
        };
        log(`❌ ${state}: Failed - ${stateResult.error || 'Unknown error'}`, 'red');
      }

      // Add delay between states to be respectful to news sources
      if (states.indexOf(state) < states.length - 1) {
        log(`⏳ Waiting 3 seconds before next state...`, 'yellow');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      results.failedStates++;
      results.stateResults[state] = {
        success: false,
        error: error.message,
        total: 0,
        unique: 0,
        duplicatesRemoved: 0,
        inserted: 0
      };
      log(`❌ ${state}: Exception - ${error.message}`, 'red');
    }
  }

  return results;
}

async function displayFinalStats(results) {
  log('\n' + '='.repeat(70), 'cyan');
  log('📊 DATABASE RESET & POPULATION COMPLETE', 'bright');
  log('='.repeat(70), 'cyan');
  
  log(`\n📈 SUMMARY STATISTICS:`, 'bright');
  log(`   Total Articles Scraped: ${results.totalArticles}`, 'blue');
  log(`   Unique Articles (after deduplication): ${results.totalUnique}`, 'green');
  log(`   Duplicates Removed: ${results.totalDuplicatesRemoved}`, 'yellow');
  log(`   Articles Saved to Database: ${Object.values(results.stateResults).reduce((sum, state) => sum + (state.inserted || 0), 0)}`, 'green');
  log(`   Successful States: ${results.successfulStates}`, 'green');
  log(`   Failed States: ${results.failedStates}`, results.failedStates > 0 ? 'red' : 'green');
  log(`   Success Rate: ${((results.successfulStates / (results.successfulStates + results.failedStates)) * 100).toFixed(1)}%`, 'cyan');

  log(`\n📋 DETAILED RESULTS BY STATE:`, 'bright');
  Object.entries(results.stateResults).forEach(([state, result]) => {
    if (result.success) {
      log(`   ✅ ${state.padEnd(20)} | Scraped: ${result.total.toString().padStart(3)} | Geo-Relevant: ${(result.geographicallyRelevant || result.total).toString().padStart(3)} | Unique: ${result.unique.toString().padStart(3)} | Saved: ${result.inserted.toString().padStart(3)}`, 'green');
      if (result.geoFiltered > 0) {
        log(`      ${' '.repeat(20)} | Geographic Filter: ${result.geoFiltered.toString().padStart(3)} | Duplicates: ${result.duplicatesRemoved.toString().padStart(3)}`, 'yellow');
      } else {
        log(`      ${' '.repeat(20)} | Duplicates: ${result.duplicatesRemoved.toString().padStart(3)}`, 'yellow');
      }
    } else {
      log(`   ❌ ${state.padEnd(20)} | ${result.error}`, 'red');
    }
  });

  // Show sample of articles in database
  try {
    const sampleArticles = await Article.find({}).limit(3).select('title aiPunchline state source');
    if (sampleArticles.length > 0) {
      log(`\n🎯 SAMPLE AI-ENHANCED ARTICLES:`, 'bright');
      sampleArticles.forEach((article, index) => {
        log(`   ${index + 1}. ${article.title}`, 'blue');
        log(`      🎪 AI Punchline: "${article.aiPunchline}"`, 'magenta');
        log(`      📍 ${article.state} | 📰 ${article.source}\n`, 'yellow');
      });
    }
  } catch (error) {
    log(`⚠️  Could not fetch sample articles: ${error.message}`, 'yellow');
  }

  log('🎉 Your MongoDB Atlas database is now populated with fresh, AI-enhanced articles!', 'green');
  log('💡 All articles include AI-generated punchlines and summaries for better engagement.', 'cyan');
  log('🔄 Duplicate detection ensured no repeated articles within each state.\n', 'cyan');
}

async function resetAndPopulateDatabase() {
  const startTime = Date.now();
  
  try {
    // Connect to MongoDB Atlas
    log('🔗 Connecting to MongoDB Atlas...', 'cyan');
    await mongoose.connect(process.env.MONGODB_URI);
    log('✅ Connected to MongoDB Atlas successfully', 'green');

    // Clear existing data
    const clearedCount = await clearDatabase();
    
    // Populate with fresh articles
    const results = await populateWithFreshArticles();
    
    // Display final statistics
    await displayFinalStats(results);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000 / 60).toFixed(1);
    log(`⏱️  Total execution time: ${duration} minutes`, 'cyan');

  } catch (error) {
    log(`\n💥 FATAL ERROR: ${error.message}`, 'red');
    log('Stack trace:', 'red');
    console.error(error.stack);
  } finally {
    // Always disconnect
    try {
      await mongoose.disconnect();
      log('🔌 Disconnected from MongoDB Atlas', 'yellow');
    } catch (disconnectError) {
      log(`⚠️  Error disconnecting: ${disconnectError.message}`, 'yellow');
    }
  }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  log('\n\n⚠️  Process interrupted by user', 'yellow');
  try {
    await mongoose.disconnect();
    log('🔌 Disconnected from MongoDB Atlas', 'yellow');
  } catch (error) {
    log(`❌ Error during cleanup: ${error.message}`, 'red');
  }
  process.exit(0);
});

// Run the script
if (require.main === module) {
  log('🎬 Starting Database Reset & Population Script...', 'bright');
  log('⚡ This will clear your MongoDB Atlas database and refill it with AI-enhanced articles', 'cyan');
  log('🔄 Includes intelligent duplicate detection within each state\n', 'cyan');
  
  resetAndPopulateDatabase()
    .then(() => {
      log('🏁 Script completed successfully!', 'green');
      process.exit(0);
    })
    .catch((error) => {
      log(`💥 Script failed: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = { resetAndPopulateDatabase, clearDatabase, populateWithFreshArticles };