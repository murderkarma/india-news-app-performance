#!/usr/bin/env node

/**
 * Batch Testing Script for Quick Validation
 * 
 * This script runs quick tests on all sources to identify issues fast.
 * Use this for rapid iteration when updating selectors.
 * 
 * Usage:
 *   node test/batchTest.js                    # Test all sources quickly
 *   node test/batchTest.js --state Assam     # Test specific state
 *   node test/batchTest.js --fix-selectors   # Interactive mode to fix selectors
 */

const { testSource, STATE_CONFIGS } = require('../scrapes/scraperTemplate');
const fs = require('fs').promises;
const path = require('path');

// Quick test configuration
const QUICK_CONFIG = {
  TIMEOUT: 15000, // 15 seconds per source
  MIN_ARTICLES: 2, // Lower threshold for quick tests
  MAX_CONCURRENT: 3, // Test 3 sources at once
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Quick test result tracking
class QuickTestResults {
  constructor() {
    this.results = [];
    this.summary = {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    };
  }

  addResult(state, sourceName, result) {
    this.results.push({
      state,
      sourceName,
      ...result,
      timestamp: new Date().toISOString()
    });
    
    this.summary.total++;
    if (result.status === 'pass') {
      this.summary.passed++;
    } else if (result.status === 'fail') {
      this.summary.failed++;
    } else if (result.status === 'warning') {
      this.summary.warnings++;
    }
  }

  getFailedSources() {
    return this.results.filter(r => r.status === 'fail');
  }

  generateQuickReport() {
    console.log(`\n${colors.cyan}📊 QUICK TEST SUMMARY${colors.reset}`);
    console.log(`Total Sources: ${this.summary.total}`);
    console.log(`${colors.green}✅ Passed: ${this.summary.passed}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Warnings: ${this.summary.warnings}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${this.summary.failed}${colors.reset}`);
    
    if (this.summary.failed > 0) {
      console.log(`\n${colors.red}Failed Sources:${colors.reset}`);
      this.getFailedSources().forEach(result => {
        console.log(`  ${result.state} - ${result.sourceName}: ${result.error}`);
      });
    }

    // Success rate
    const successRate = ((this.summary.passed / this.summary.total) * 100).toFixed(1);
    console.log(`\n${colors.cyan}Success Rate: ${successRate}%${colors.reset}`);
    
    if (successRate >= 90) {
      console.log(`${colors.green}🎉 Excellent! Your scrapers are working great!${colors.reset}`);
    } else if (successRate >= 70) {
      console.log(`${colors.yellow}👍 Good, but some sources need attention.${colors.reset}`);
    } else {
      console.log(`${colors.red}⚠️  Many sources are failing. Review your selectors.${colors.reset}`);
    }
  }

  async saveReport(filename = 'quick-test-report.json') {
    const reportPath = path.join(__dirname, filename);
    const report = {
      timestamp: new Date().toISOString(),
      summary: this.summary,
      results: this.results
    };
    
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }
}

// Quick test a single source
async function quickTestSource(state, sourceConfig) {
  const sourceName = sourceConfig.name;
  
  try {
    console.log(`${colors.blue}🧪 Testing ${sourceName}...${colors.reset}`);
    
    const articles = await Promise.race([
      testSource(state, sourceConfig),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), QUICK_CONFIG.TIMEOUT)
      )
    ]);

    if (articles.length === 0) {
      return {
        status: 'fail',
        articlesFound: 0,
        error: 'No articles found - check selectors'
      };
    }

    if (articles.length < QUICK_CONFIG.MIN_ARTICLES) {
      return {
        status: 'warning',
        articlesFound: articles.length,
        error: `Only ${articles.length} articles found (expected ${QUICK_CONFIG.MIN_ARTICLES}+)`
      };
    }

    // Quick validation - check if articles have basic required fields
    const validArticles = articles.filter(article => 
      article.title && article.link && article.title.length > 5
    );

    if (validArticles.length < articles.length * 0.8) {
      return {
        status: 'warning',
        articlesFound: articles.length,
        validArticles: validArticles.length,
        error: 'Some articles missing required fields'
      };
    }

    console.log(`${colors.green}✅ ${sourceName}: ${validArticles.length} valid articles${colors.reset}`);
    return {
      status: 'pass',
      articlesFound: articles.length,
      validArticles: validArticles.length
    };

  } catch (error) {
    console.log(`${colors.red}❌ ${sourceName}: ${error.message}${colors.reset}`);
    return {
      status: 'fail',
      articlesFound: 0,
      error: error.message
    };
  }
}

// Batch test with concurrency control
async function batchTest(statesToTest, options = {}) {
  const results = new QuickTestResults();
  const allTasks = [];

  // Collect all test tasks
  for (const state of statesToTest) {
    const stateConfig = STATE_CONFIGS[state];
    if (!stateConfig || !stateConfig.sources.length) {
      console.log(`${colors.yellow}⚠️  No sources configured for ${state}${colors.reset}`);
      continue;
    }

    for (const sourceConfig of stateConfig.sources) {
      allTasks.push({ state, sourceConfig });
    }
  }

  console.log(`\n${colors.cyan}🚀 Starting batch test of ${allTasks.length} sources...${colors.reset}\n`);

  // Process tasks in batches
  for (let i = 0; i < allTasks.length; i += QUICK_CONFIG.MAX_CONCURRENT) {
    const batch = allTasks.slice(i, i + QUICK_CONFIG.MAX_CONCURRENT);
    
    const batchPromises = batch.map(async ({ state, sourceConfig }) => {
      const result = await quickTestSource(state, sourceConfig);
      results.addResult(state, sourceConfig.name, result);
    });

    await Promise.all(batchPromises);
    
    // Small delay between batches to be respectful to servers
    if (i + QUICK_CONFIG.MAX_CONCURRENT < allTasks.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  results.generateQuickReport();
  
  if (options.saveReport) {
    await results.saveReport();
  }

  return results;
}

// Interactive selector fixing mode
async function interactiveFix(failedSources) {
  console.log(`\n${colors.magenta}🔧 INTERACTIVE SELECTOR FIXING MODE${colors.reset}`);
  console.log('This would help you fix selectors interactively.');
  console.log('(Implementation would include prompts to test new selectors)');
  
  // This is a placeholder for interactive functionality
  // In a full implementation, you could:
  // 1. Show the current selectors
  // 2. Let user input new selectors
  // 3. Test them immediately
  // 4. Update the configuration file
  
  failedSources.forEach(source => {
    console.log(`\n${colors.red}Failed: ${source.state} - ${source.sourceName}${colors.reset}`);
    console.log(`Error: ${source.error}`);
    console.log('Current selectors would be shown here...');
  });
}

// Generate selector health report
async function generateSelectorHealthReport(results) {
  const healthReport = {
    timestamp: new Date().toISOString(),
    overallHealth: (results.summary.passed / results.summary.total * 100).toFixed(1),
    stateHealth: {},
    recommendations: []
  };

  // Calculate health by state
  const stateGroups = {};
  results.results.forEach(result => {
    if (!stateGroups[result.state]) {
      stateGroups[result.state] = { total: 0, passed: 0 };
    }
    stateGroups[result.state].total++;
    if (result.status === 'pass') {
      stateGroups[result.state].passed++;
    }
  });

  Object.entries(stateGroups).forEach(([state, stats]) => {
    healthReport.stateHealth[state] = {
      successRate: (stats.passed / stats.total * 100).toFixed(1),
      workingSources: stats.passed,
      totalSources: stats.total
    };
  });

  // Generate recommendations
  if (results.summary.failed > 0) {
    healthReport.recommendations.push('Review failed sources for CSS selector updates');
  }
  if (results.summary.warnings > 0) {
    healthReport.recommendations.push('Check warning sources for potential improvements');
  }
  if (results.summary.passed / results.summary.total < 0.8) {
    healthReport.recommendations.push('Consider adding more reliable news sources');
  }

  const reportPath = path.join(__dirname, 'selector-health-report.json');
  await fs.writeFile(reportPath, JSON.stringify(healthReport, null, 2));
  
  console.log(`\n${colors.cyan}📋 Selector Health Report:${colors.reset}`);
  console.log(`Overall Health: ${healthReport.overallHealth}%`);
  Object.entries(healthReport.stateHealth).forEach(([state, health]) => {
    console.log(`  ${state}: ${health.successRate}% (${health.workingSources}/${health.totalSources})`);
  });
  
  if (healthReport.recommendations.length > 0) {
    console.log(`\n${colors.yellow}Recommendations:${colors.reset}`);
    healthReport.recommendations.forEach(rec => {
      console.log(`  • ${rec}`);
    });
  }
  
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const options = {
    saveReport: true,
    fixSelectors: false
  };

  let statesToTest = Object.keys(STATE_CONFIGS);

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--state':
        statesToTest = [args[++i]];
        break;
      case '--fix-selectors':
        options.fixSelectors = true;
        break;
      case '--no-report':
        options.saveReport = false;
        break;
      case '--help':
        console.log(`
Batch Test Script Usage:

  node test/batchTest.js [options]

Options:
  --state <StateName>    Test specific state only
  --fix-selectors       Enter interactive fixing mode for failed sources
  --no-report          Don't save test report
  --help               Show this help message

Examples:
  node test/batchTest.js
  node test/batchTest.js --state Assam
  node test/batchTest.js --fix-selectors
        `);
        process.exit(0);
    }
  }

  try {
    const results = await batchTest(statesToTest, options);
    
    if (options.saveReport) {
      await generateSelectorHealthReport(results);
    }
    
    if (options.fixSelectors && results.summary.failed > 0) {
      await interactiveFix(results.getFailedSources());
    }

    // Exit with appropriate code
    process.exit(results.summary.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error(`${colors.red}❌ Batch test failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  quickTestSource,
  batchTest,
  QuickTestResults
};