#!/usr/bin/env node

/**
 * Interactive CSS Selector Debugger
 * 
 * This tool helps you debug and fix CSS selectors by:
 * 1. Fetching the webpage
 * 2. Testing your selectors interactively
 * 3. Showing you what each selector finds
 * 4. Suggesting improvements
 * 
 * Usage:
 *   node test/selectorDebugger.js
 *   node test/selectorDebugger.js --url https://example.com --interactive
 */

const axios = require('axios');
const cheerio = require('cheerio');
const readline = require('readline');
const fs = require('fs').promises;
const { STATE_CONFIGS } = require('../scrapes/scraperTemplate');

// Colors for better output
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

class SelectorDebugger {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    this.$ = null;
    this.currentUrl = null;
    this.currentHtml = null;
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(`${colors.cyan}${prompt}${colors.reset}`, resolve);
    });
  }

  async fetchPage(url) {
    try {
      this.log(`🌐 Fetching ${url}...`, 'blue');
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 15000
      });

      this.currentUrl = url;
      this.currentHtml = response.data;
      this.$ = cheerio.load(response.data);
      
      this.log(`✅ Page loaded successfully (${response.data.length} characters)`, 'green');
      return true;
    } catch (error) {
      this.log(`❌ Failed to fetch page: ${error.message}`, 'red');
      return false;
    }
  }

  testSelector(selector, description = '') {
    if (!this.$) {
      this.log('❌ No page loaded. Use fetchPage() first.', 'red');
      return null;
    }

    try {
      const elements = this.$(selector);
      const count = elements.length;
      
      this.log(`\n🔍 Testing selector: ${selector}`, 'yellow');
      if (description) {
        this.log(`   Description: ${description}`, 'cyan');
      }
      this.log(`   Found: ${count} elements`, count > 0 ? 'green' : 'red');

      if (count > 0) {
        // Show first few results
        const maxShow = Math.min(count, 3);
        for (let i = 0; i < maxShow; i++) {
          const element = elements.eq(i);
          const text = element.text().trim().substring(0, 100);
          const href = element.attr('href');
          const src = element.attr('src');
          
          this.log(`   [${i + 1}] Text: "${text}${text.length === 100 ? '...' : ''}"`, 'cyan');
          if (href) this.log(`       Href: ${href}`, 'cyan');
          if (src) this.log(`       Src: ${src}`, 'cyan');
        }
        
        if (count > maxShow) {
          this.log(`   ... and ${count - maxShow} more`, 'yellow');
        }
      } else {
        this.log('   💡 Try using browser DevTools to find the correct selector', 'yellow');
      }

      return { count, elements };
    } catch (error) {
      this.log(`❌ Selector error: ${error.message}`, 'red');
      return null;
    }
  }

  suggestSelectors(baseSelector) {
    if (!this.$) return [];

    const suggestions = [];
    const base = this.$(baseSelector);
    
    if (base.length === 0) {
      // Try common article containers
      const commonSelectors = [
        'article',
        '.post',
        '.article',
        '.news-item',
        '.story',
        '[class*="post"]',
        '[class*="article"]',
        '[class*="news"]',
        '[class*="story"]'
      ];
      
      commonSelectors.forEach(sel => {
        const count = this.$(sel).length;
        if (count > 0) {
          suggestions.push({ selector: sel, count, type: 'container' });
        }
      });
    } else {
      // Suggest child selectors
      const firstElement = base.first();
      
      // Common title selectors
      const titleSelectors = ['h1', 'h2', 'h3', '.title', '.headline', 'a'];
      titleSelectors.forEach(sel => {
        const found = firstElement.find(sel);
        if (found.length > 0) {
          suggestions.push({ 
            selector: `${baseSelector} ${sel}`, 
            count: found.length, 
            type: 'title',
            sample: found.first().text().trim().substring(0, 50)
          });
        }
      });

      // Common image selectors
      const imgSelectors = ['img', '.image', '.thumbnail', 'figure img'];
      imgSelectors.forEach(sel => {
        const found = firstElement.find(sel);
        if (found.length > 0) {
          suggestions.push({ 
            selector: `${baseSelector} ${sel}`, 
            count: found.length, 
            type: 'image',
            sample: found.first().attr('src') || found.first().attr('data-src') || 'No src'
          });
        }
      });
    }

    return suggestions;
  }

  async interactiveMode() {
    this.log('\n🎯 Interactive CSS Selector Debugger', 'bright');
    this.log('Type "help" for available commands\n', 'cyan');

    while (true) {
      const input = await this.question('debugger> ');
      const [command, ...args] = input.trim().split(' ');

      switch (command.toLowerCase()) {
        case 'help':
          this.showHelp();
          break;

        case 'load':
          if (args.length === 0) {
            this.log('Usage: load <url>', 'yellow');
            break;
          }
          await this.fetchPage(args[0]);
          break;

        case 'test':
          if (args.length === 0) {
            this.log('Usage: test <css-selector>', 'yellow');
            break;
          }
          this.testSelector(args.join(' '));
          break;

        case 'suggest':
          if (args.length === 0) {
            this.log('Usage: suggest <base-selector>', 'yellow');
            break;
          }
          this.showSuggestions(args.join(' '));
          break;

        case 'source':
          await this.debugSource();
          break;

        case 'save':
          if (args.length === 0) {
            this.log('Usage: save <filename>', 'yellow');
            break;
          }
          await this.saveHtml(args[0]);
          break;

        case 'states':
          this.listStates();
          break;

        case 'config':
          if (args.length < 2) {
            this.log('Usage: config <state> <source>', 'yellow');
            break;
          }
          this.showSourceConfig(args[0], args[1]);
          break;

        case 'validate':
          await this.validateCurrentSelectors();
          break;

        case 'exit':
        case 'quit':
          this.log('Goodbye! 👋', 'green');
          this.rl.close();
          return;

        case '':
          break;

        default:
          this.log(`Unknown command: ${command}. Type "help" for available commands.`, 'red');
      }
    }
  }

  showHelp() {
    this.log('\n📚 Available Commands:', 'bright');
    this.log('  load <url>              - Load a webpage for testing', 'cyan');
    this.log('  test <selector>         - Test a CSS selector', 'cyan');
    this.log('  suggest <base-selector> - Get selector suggestions', 'cyan');
    this.log('  source                  - Debug a configured source', 'cyan');
    this.log('  save <filename>         - Save current HTML to file', 'cyan');
    this.log('  states                  - List all configured states', 'cyan');
    this.log('  config <state> <source> - Show source configuration', 'cyan');
    this.log('  validate                - Validate current page selectors', 'cyan');
    this.log('  help                    - Show this help', 'cyan');
    this.log('  exit                    - Exit debugger', 'cyan');
    this.log('\nExamples:', 'yellow');
    this.log('  load https://nenow.in/north-east-news/assam', 'green');
    this.log('  test article.post', 'green');
    this.log('  suggest article.post', 'green');
    this.log('  config Assam "Northeast Now"', 'green');
  }

  showSuggestions(baseSelector) {
    const suggestions = this.suggestSelectors(baseSelector);
    
    if (suggestions.length === 0) {
      this.log('No suggestions found. Try a different base selector.', 'yellow');
      return;
    }

    this.log(`\n💡 Suggestions for "${baseSelector}":`, 'bright');
    suggestions.forEach((suggestion, index) => {
      this.log(`  ${index + 1}. ${suggestion.selector} (${suggestion.count} found, ${suggestion.type})`, 'cyan');
      if (suggestion.sample) {
        this.log(`     Sample: "${suggestion.sample}"`, 'yellow');
      }
    });
  }

  async debugSource() {
    this.log('\n🔧 Source Debugger', 'bright');
    
    const state = await this.question('Enter state name: ');
    const stateConfig = STATE_CONFIGS[state];
    
    if (!stateConfig) {
      this.log(`State "${state}" not found in configuration.`, 'red');
      return;
    }

    this.log(`\nAvailable sources for ${state}:`, 'cyan');
    stateConfig.sources.forEach((source, index) => {
      this.log(`  ${index + 1}. ${source.name}`, 'yellow');
    });

    const sourceIndex = parseInt(await this.question('Enter source number: ')) - 1;
    const sourceConfig = stateConfig.sources[sourceIndex];
    
    if (!sourceConfig) {
      this.log('Invalid source number.', 'red');
      return;
    }

    this.log(`\n🎯 Debugging: ${sourceConfig.name}`, 'bright');
    
    // Load the page
    const url = sourceConfig.url || sourceConfig.base_url;
    const loaded = await this.fetchPage(url);
    
    if (!loaded) return;

    // Test each selector
    const selectors = sourceConfig.selectors;
    if (selectors) {
      this.log('\n🧪 Testing configured selectors:', 'bright');
      this.testSelector(selectors.articles, 'Article containers');
      this.testSelector(selectors.title, 'Article titles');
      this.testSelector(selectors.link, 'Article links');
      this.testSelector(selectors.image, 'Article images');
      this.testSelector(selectors.summary, 'Article summaries');
    } else {
      this.log('\n🧪 Testing configured selectors:', 'bright');
      this.testSelector(sourceConfig.article_selector, 'Article containers');
      this.testSelector(sourceConfig.title_selector, 'Article titles');
      this.testSelector(sourceConfig.url_selector, 'Article URLs');
    }
  }

  async saveHtml(filename) {
    if (!this.currentHtml) {
      this.log('No HTML loaded to save.', 'red');
      return;
    }

    try {
      await fs.writeFile(filename, this.currentHtml);
      this.log(`✅ HTML saved to ${filename}`, 'green');
    } catch (error) {
      this.log(`❌ Failed to save HTML: ${error.message}`, 'red');
    }
  }

  listStates() {
    this.log('\n🏛️  Configured States:', 'bright');
    Object.keys(STATE_CONFIGS).forEach(state => {
      const sourceCount = STATE_CONFIGS[state].sources.length;
      this.log(`  ${state} (${sourceCount} sources)`, 'cyan');
    });
  }

  showSourceConfig(state, sourceName) {
    const stateConfig = STATE_CONFIGS[state];
    if (!stateConfig) {
      this.log(`State "${state}" not found.`, 'red');
      return;
    }

    const sourceConfig = stateConfig.sources.find(s => 
      s.name.toLowerCase().includes(sourceName.toLowerCase())
    );

    if (!sourceConfig) {
      this.log(`Source "${sourceName}" not found in ${state}.`, 'red');
      return;
    }

    this.log(`\n⚙️  Configuration for ${sourceConfig.name}:`, 'bright');
    this.log(`URL: ${sourceConfig.url || sourceConfig.base_url}`, 'cyan');
    
    if (sourceConfig.selectors) {
      this.log('Selectors:', 'yellow');
      Object.entries(sourceConfig.selectors).forEach(([key, value]) => {
        this.log(`  ${key}: ${value}`, 'cyan');
      });
    } else {
      this.log('Selectors:', 'yellow');
      this.log(`  articles: ${sourceConfig.article_selector}`, 'cyan');
      this.log(`  title: ${sourceConfig.title_selector}`, 'cyan');
      this.log(`  url: ${sourceConfig.url_selector}`, 'cyan');
    }

    if (sourceConfig.fallbackImage) {
      this.log(`Fallback Image: ${sourceConfig.fallbackImage}`, 'cyan');
    }
  }

  async validateCurrentSelectors() {
    if (!this.$) {
      this.log('No page loaded. Use "load <url>" first.', 'red');
      return;
    }

    this.log('\n🔍 Validating common article patterns...', 'bright');
    
    const patterns = [
      { name: 'Articles', selectors: ['article', '.post', '.article', '.news-item'] },
      { name: 'Titles', selectors: ['h1', 'h2', 'h3', '.title', '.headline'] },
      { name: 'Links', selectors: ['a[href]'] },
      { name: 'Images', selectors: ['img[src]', 'img[data-src]'] }
    ];

    patterns.forEach(pattern => {
      this.log(`\n${pattern.name}:`, 'yellow');
      pattern.selectors.forEach(selector => {
        const count = this.$(selector).length;
        const status = count > 0 ? '✅' : '❌';
        this.log(`  ${status} ${selector}: ${count} found`, count > 0 ? 'green' : 'red');
      });
    });
  }

  close() {
    this.rl.close();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const selectorDebugger = new SelectorDebugger();

  if (args.includes('--help')) {
    console.log(`
CSS Selector Debugger Usage:

  node test/selectorDebugger.js                    # Interactive mode
  node test/selectorDebugger.js --url <url>        # Load URL and start interactive mode
  node test/selectorDebugger.js --test <selector>  # Quick test a selector

Examples:
  node test/selectorDebugger.js
  node test/selectorDebugger.js --url https://nenow.in/north-east-news/assam
    `);
    process.exit(0);
  }

  try {
    // Handle command line arguments
    const urlIndex = args.indexOf('--url');
    if (urlIndex !== -1 && args[urlIndex + 1]) {
      await selectorDebugger.fetchPage(args[urlIndex + 1]);
    }

    const testIndex = args.indexOf('--test');
    if (testIndex !== -1 && args[testIndex + 1]) {
      if (!selectorDebugger.$) {
        selectorDebugger.log('No page loaded. Provide --url first.', 'red');
        process.exit(1);
      }
      selectorDebugger.testSelector(args[testIndex + 1]);
      selectorDebugger.close();
      return;
    }

    // Start interactive mode
    await selectorDebugger.interactiveMode();
    
  } catch (error) {
    console.error(`❌ Debugger failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = SelectorDebugger;