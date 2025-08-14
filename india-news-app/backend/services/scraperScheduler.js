/**
 * Automated Scraper Scheduler Service
 * 
 * Features:
 * - Runs every 4 hours (6 cycles/day)
 * - Staggered source scraping (7 sources per cycle)
 * - Intelligent duplicate detection
 * - Automatic cleanup of old articles (3+ days)
 * - Comprehensive logging and monitoring
 * - Rate limiting and polite delays
 * - Error handling and recovery
 */

const cron = require('node-cron');
const mongoose = require('mongoose');
const Article = require('../articleModel');
const { STATE_CONFIGS } = require('../scrapes/scraperTemplate');
const { scrapeStateConfig } = require('../scrapes/scraperTemplate');
const crypto = require('crypto');

class ScraperScheduler {
  constructor() {
    this.isRunning = false;
    this.currentCycle = 0;
    this.sourceRotation = this.createSourceRotation();
    this.stats = {
      totalCycles: 0,
      totalArticlesScraped: 0,
      totalArticlesInserted: 0,
      totalArticlesRemoved: 0,
      lastRun: null,
      averageRunTime: 0
    };
    
    // Configuration
    this.config = {
      cycleInterval: '0 */4 * * *', // Every 4 hours
      sourcesPerCycle: 7,           // Stagger sources
      requestDelay: 2000,           // 2 seconds between requests
      maxRetries: 3,                // Retry failed sources
      cleanupDays: 3,               // Remove articles older than 3 days
      logLevel: 'info'              // info, debug, error
    };
  }

  /**
   * Create rotating source schedule
   */
  createSourceRotation() {
    const allSources = Object.keys(STATE_CONFIGS);
    const rotation = [];
    
    // Create cycles with 7 sources each
    for (let i = 0; i < allSources.length; i += this.config.sourcesPerCycle) {
      rotation.push(allSources.slice(i, i + this.config.sourcesPerCycle));
    }
    
    this.log('info', `Created ${rotation.length} rotation cycles with ${this.config.sourcesPerCycle} sources each`);
    return rotation;
  }

  /**
   * Generate content hash for duplicate detection
   */
  generateContentHash(title, link) {
    return crypto.createHash('md5')
      .update(`${title.toLowerCase().trim()}|${link}`)
      .digest('hex');
  }

  /**
   * Enhanced logging with timestamps and levels
   */
  log(level, message, data = null) {
    // Only log errors and important info in production
    if (process.env.NODE_ENV === 'production' && level === 'debug') {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [SCHEDULER-${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, data || '');
    } else if (level === 'debug' && this.config.logLevel === 'debug') {
      console.log(logMessage, data || '');
    } else if (level === 'info') {
      console.log(logMessage, data || '');
    }
  }

  /**
   * Sleep function for polite delays
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Scrape a single source with retry logic
   */
  async scrapeSingleSource(sourceKey, retryCount = 0) {
    try {
      this.log('debug', `Scraping ${sourceKey} (attempt ${retryCount + 1})`);
      
      const config = STATE_CONFIGS[sourceKey];
      const result = await scrapeStateConfig(sourceKey, config);
      
      if (result.success) {
        this.log('info', `✅ ${sourceKey}: ${result.inserted}/${result.total} new articles`);
        return {
          source: sourceKey,
          success: true,
          total: result.total,
          inserted: result.inserted,
          error: null
        };
      } else {
        throw new Error(result.error || 'Unknown scraping error');
      }
      
    } catch (error) {
      this.log('error', `❌ ${sourceKey} failed:`, error.message);
      
      // Retry logic
      if (retryCount < this.config.maxRetries) {
        this.log('info', `🔄 Retrying ${sourceKey} in 5 seconds...`);
        await this.sleep(5000);
        return this.scrapeSingleSource(sourceKey, retryCount + 1);
      }
      
      return {
        source: sourceKey,
        success: false,
        total: 0,
        inserted: 0,
        error: error.message
      };
    }
  }

  /**
   * Enhanced duplicate detection
   */
  async checkForDuplicates(articles) {
    const uniqueArticles = [];
    const duplicateHashes = new Set();
    
    // Generate hashes for new articles
    const articleHashes = articles.map(article => ({
      ...article,
      contentHash: this.generateContentHash(article.title, article.link)
    }));
    
    // Check against existing articles in database
    const existingHashes = await Article.find({
      link: { $in: articles.map(a => a.link) }
    }, { link: 1, title: 1 });
    
    const existingLinks = new Set(existingHashes.map(a => a.link));
    
    // Filter out duplicates
    for (const article of articleHashes) {
      if (!existingLinks.has(article.link) && !duplicateHashes.has(article.contentHash)) {
        uniqueArticles.push(article);
        duplicateHashes.add(article.contentHash);
      }
    }
    
    this.log('debug', `Filtered ${articles.length - uniqueArticles.length} duplicates`);
    return uniqueArticles;
  }

  /**
   * Clean up old articles
   */
  async cleanupOldArticles() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.cleanupDays);
      
      const result = await Article.deleteMany({
        $or: [
          { scrapedAt: { $lt: cutoffDate } },
          { 
            scrapedAt: { $exists: false },
            createdAt: { $lt: cutoffDate }
          }
        ]
      });
      
      this.stats.totalArticlesRemoved += result.deletedCount;
      this.log('info', `🧹 Cleaned up ${result.deletedCount} articles older than ${this.config.cleanupDays} days`);
      
      return result.deletedCount;
    } catch (error) {
      this.log('error', 'Cleanup failed:', error.message);
      return 0;
    }
  }

  /**
   * Run a single scraping cycle
   */
  async runScrapingCycle() {
    if (this.isRunning) {
      this.log('info', '⏳ Scraping cycle already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      this.log('info', `🚀 Starting scraping cycle ${this.stats.totalCycles + 1}`);
      
      // Get sources for this cycle
      const currentSources = this.sourceRotation[this.currentCycle % this.sourceRotation.length];
      this.log('info', `📋 Cycle sources: ${currentSources.join(', ')}`);
      
      const cycleResults = {
        sources: [],
        totalScraped: 0,
        totalInserted: 0,
        successfulSources: 0,
        failedSources: 0
      };
      
      // Scrape each source with polite delays
      for (let i = 0; i < currentSources.length; i++) {
        const sourceKey = currentSources[i];
        
        // Add delay between sources (except first)
        if (i > 0) {
          this.log('debug', `⏱️ Waiting ${this.config.requestDelay}ms before next source...`);
          await this.sleep(this.config.requestDelay);
        }
        
        const result = await this.scrapeSingleSource(sourceKey);
        cycleResults.sources.push(result);
        
        if (result.success) {
          cycleResults.totalScraped += result.total;
          cycleResults.totalInserted += result.inserted;
          cycleResults.successfulSources++;
        } else {
          cycleResults.failedSources++;
        }
      }
      
      // Cleanup old articles
      const cleanedUp = await this.cleanupOldArticles();
      
      // Update statistics
      this.stats.totalCycles++;
      this.stats.totalArticlesScraped += cycleResults.totalScraped;
      this.stats.totalArticlesInserted += cycleResults.totalInserted;
      this.stats.lastRun = new Date();
      
      const runTime = Date.now() - startTime;
      this.stats.averageRunTime = ((this.stats.averageRunTime * (this.stats.totalCycles - 1)) + runTime) / this.stats.totalCycles;
      
      // Move to next cycle
      this.currentCycle++;
      
      // Log cycle summary
      this.log('info', `✅ Cycle ${this.stats.totalCycles} completed in ${(runTime/1000).toFixed(1)}s`);
      this.log('info', `📊 Results: ${cycleResults.totalInserted}/${cycleResults.totalScraped} new articles, ${cycleResults.successfulSources}/${currentSources.length} sources successful`);
      
      if (cleanedUp > 0) {
        this.log('info', `🧹 Cleaned up ${cleanedUp} old articles`);
      }
      
      // Log failed sources
      const failedSources = cycleResults.sources.filter(s => !s.success);
      if (failedSources.length > 0) {
        this.log('info', `⚠️ Failed sources: ${failedSources.map(s => s.source).join(', ')}`);
      }
      
    } catch (error) {
      this.log('error', 'Scraping cycle failed:', error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get scheduler statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      currentCycle: this.currentCycle,
      nextCycleSources: this.sourceRotation[this.currentCycle % this.sourceRotation.length],
      config: this.config
    };
  }

  /**
   * Start the scheduler
   */
  start() {
    this.log('info', '🎯 Starting automated scraper scheduler');
    this.log('info', `⏰ Schedule: Every 4 hours (${this.config.cycleInterval})`);
    this.log('info', `📊 Configuration: ${this.config.sourcesPerCycle} sources per cycle, ${this.config.requestDelay}ms delays`);
    
    // Schedule the cron job
    this.cronJob = cron.schedule(this.config.cycleInterval, () => {
      this.runScrapingCycle();
    }, {
      scheduled: true,
      timezone: "America/New_York" // Adjust to your timezone
    });
    
    this.log('info', '✅ Scheduler started successfully');
    
    // Run initial cycle after 30 seconds
    setTimeout(() => {
      this.log('info', '🚀 Running initial scraping cycle...');
      this.runScrapingCycle();
    }, 30000);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.log('info', '🛑 Scheduler stopped');
    }
  }

  /**
   * Run a manual cycle (for testing)
   */
  async runManualCycle() {
    this.log('info', '🔧 Running manual scraping cycle...');
    await this.runScrapingCycle();
  }
}

module.exports = ScraperScheduler;