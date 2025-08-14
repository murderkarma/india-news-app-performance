/**
 * Jest Test Suite for News Scraper
 * 
 * Run with: npm test
 * Run specific tests: npm test -- --testNamePattern="Assam"
 */

const mongoose = require('mongoose');
const { testSource, scrapeSource, STATE_CONFIGS } = require('../scrapes/scraperTemplate');
const Article = require('../articleModel');
const { validateArticle, TestResults } = require('./scraperQA');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Test configuration
const TEST_CONFIG = {
  TIMEOUT: 30000,
  MIN_ARTICLES: 3,
  SAMPLE_STATES: ['Assam', 'Manipur', 'Meghalaya'], // Test subset for faster runs
};

// Setup and teardown
beforeAll(async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
});

describe('News Scraper Test Suite', () => {
  
  describe('Configuration Validation', () => {
    test('STATE_CONFIGS should be properly structured', () => {
      expect(STATE_CONFIGS).toBeDefined();
      expect(typeof STATE_CONFIGS).toBe('object');
      expect(Object.keys(STATE_CONFIGS).length).toBeGreaterThan(0);
    });

    test('Each state should have valid source configurations', () => {
      Object.entries(STATE_CONFIGS).forEach(([state, config]) => {
        expect(config).toHaveProperty('sources');
        expect(Array.isArray(config.sources)).toBe(true);
        expect(config.sources.length).toBeGreaterThan(0);

        config.sources.forEach((source, index) => {
          expect(source).toHaveProperty('name');
          expect(typeof source.name).toBe('string');
          expect(source.name.length).toBeGreaterThan(0);
          
          // Should have either url or base_url
          expect(source.url || source.base_url).toBeDefined();
          
          // Should have selectors
          expect(source.selectors || source.article_selector).toBeDefined();
        });
      });
    });
  });

  describe('CSS Selector Testing', () => {
    // Test each state's first source (to keep tests manageable)
    TEST_CONFIG.SAMPLE_STATES.forEach(state => {
      describe(`${state} Sources`, () => {
        const stateConfig = STATE_CONFIGS[state];
        
        if (!stateConfig || !stateConfig.sources.length) {
          test.skip(`${state} - No sources configured`);
          return;
        }

        // Test first source for each state
        const sourceConfig = stateConfig.sources[0];
        
        test(`${sourceConfig.name} should extract valid articles`, async () => {
          const articles = await testSource(state, sourceConfig);
          
          expect(articles).toBeDefined();
          expect(Array.isArray(articles)).toBe(true);
          expect(articles.length).toBeGreaterThanOrEqual(TEST_CONFIG.MIN_ARTICLES);

          // Validate each article
          articles.forEach((article, index) => {
            const validation = validateArticle(article, sourceConfig.name);
            expect(validation.isValid).toBe(true);
            
            // Basic structure tests
            expect(article).toHaveProperty('title');
            expect(article).toHaveProperty('link');
            expect(article).toHaveProperty('state');
            expect(article).toHaveProperty('source');
            
            expect(typeof article.title).toBe('string');
            expect(article.title.length).toBeGreaterThan(5);
            expect(article.link).toMatch(/^https?:\/\//);
            expect(article.state).toBe(state);
            expect(article.source).toBe(sourceConfig.name);
          });
        }, TEST_CONFIG.TIMEOUT);
      });
    });
  });

  describe('Database Integration', () => {
    test('Article model should save scraped articles correctly', async () => {
      const testArticle = {
        title: 'Test Article for Jest',
        link: 'https://example.com/test-article',
        image: 'https://example.com/test-image.jpg',
        summary: 'This is a test article summary',
        state: 'Assam',
        source: 'Test Source',
        scrapedAt: new Date()
      };

      const savedArticle = await Article.create(testArticle);
      expect(savedArticle._id).toBeDefined();
      expect(savedArticle.title).toBe(testArticle.title);
      expect(savedArticle.state).toBe(testArticle.state);

      // Cleanup
      await Article.deleteOne({ _id: savedArticle._id });
    });

    test('Should handle duplicate articles correctly', async () => {
      const testArticle = {
        title: 'Duplicate Test Article',
        link: 'https://example.com/duplicate-test',
        state: 'Assam',
        source: 'Test Source'
      };

      // Insert first article
      const first = await Article.create(testArticle);
      expect(first._id).toBeDefined();

      // Try to insert duplicate (should work since no unique constraint on link)
      const second = await Article.create(testArticle);
      expect(second._id).toBeDefined();
      expect(second._id.toString()).not.toBe(first._id.toString());

      // Cleanup
      await Article.deleteMany({ link: testArticle.link });
    });
  });

  describe('Data Validation', () => {
    test('validateArticle should correctly identify valid articles', () => {
      const validArticle = {
        title: 'Valid Test Article Title',
        link: 'https://example.com/valid-article',
        image: 'https://example.com/image.jpg',
        summary: 'Valid summary text',
        state: 'Assam',
        source: 'Test Source'
      };

      const validation = validateArticle(validArticle, 'Test Source');
      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('validateArticle should identify invalid articles', () => {
      const invalidArticle = {
        title: '', // Empty title
        link: 'not-a-url', // Invalid URL
        state: 'Assam',
        source: 'Test Source'
        // Missing required fields
      };

      const validation = validateArticle(invalidArticle, 'Test Source');
      expect(validation.isValid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
    });

    test('Should handle missing optional fields gracefully', () => {
      const articleWithoutOptionals = {
        title: 'Article Without Optional Fields',
        link: 'https://example.com/no-optionals',
        state: 'Assam',
        source: 'Test Source'
        // No image, summary, etc.
      };

      const validation = validateArticle(articleWithoutOptionals, 'Test Source');
      // Should still be valid even without optional fields
      expect(validation.isValid).toBe(false); // Will fail due to missing image
      expect(validation.issues).toContain('No image found (fallback should be applied)');
    });
  });

  describe('Error Handling', () => {
    test('Should handle network timeouts gracefully', async () => {
      const invalidSource = {
        name: 'Invalid Source',
        url: 'https://httpstat.us/408', // Returns timeout
        selectors: {
          articles: '.article',
          title: '.title',
          link: '.link'
        }
      };

      const articles = await testSource('TestState', invalidSource);
      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBe(0);
    }, 15000);

    test('Should handle invalid CSS selectors', async () => {
      const sourceWithBadSelectors = {
        name: 'Bad Selectors Source',
        url: 'https://httpbin.org/html', // Returns basic HTML
        selectors: {
          articles: '.nonexistent-selector',
          title: '.also-nonexistent',
          link: '.still-nonexistent'
        }
      };

      const articles = await testSource('TestState', sourceWithBadSelectors);
      expect(Array.isArray(articles)).toBe(true);
      expect(articles.length).toBe(0);
    });
  });

  describe('Performance Tests', () => {
    test('Source testing should complete within timeout', async () => {
      const state = 'Assam';
      const sourceConfig = STATE_CONFIGS[state].sources[0];
      
      const startTime = Date.now();
      const articles = await testSource(state, sourceConfig);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(TEST_CONFIG.TIMEOUT);
      expect(articles).toBeDefined();
    }, TEST_CONFIG.TIMEOUT);

    test('Database operations should be reasonably fast', async () => {
      const testArticles = Array.from({ length: 10 }, (_, i) => ({
        title: `Performance Test Article ${i}`,
        link: `https://example.com/perf-test-${i}`,
        state: 'TestState',
        source: 'Performance Test'
      }));

      const startTime = Date.now();
      const inserted = await Article.insertMany(testArticles);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(inserted.length).toBe(10);

      // Cleanup
      await Article.deleteMany({ source: 'Performance Test' });
    });
  });

  describe('Integration Tests', () => {
    test('Full scraping workflow should work end-to-end', async () => {
      const state = 'Assam';
      const sourceConfig = STATE_CONFIGS[state].sources[0];
      
      // Count existing articles
      const beforeCount = await Article.countDocuments({ state, source: sourceConfig.name });
      
      // Scrape articles
      const articles = await scrapeSource(state, sourceConfig);
      expect(articles.length).toBeGreaterThan(0);
      
      // Insert into database
      const inserted = await Article.insertMany(articles);
      expect(inserted.length).toBe(articles.length);
      
      // Verify in database
      const afterCount = await Article.countDocuments({ state, source: sourceConfig.name });
      expect(afterCount).toBe(beforeCount + articles.length);
      
      // Cleanup test data
      await Article.deleteMany({ 
        _id: { $in: inserted.map(a => a._id) }
      });
    }, TEST_CONFIG.TIMEOUT * 2);
  });
});

// Custom Jest matchers for better assertions
expect.extend({
  toBeValidUrl(received) {
    const pass = typeof received === 'string' && /^https?:\/\//.test(received);
    return {
      message: () => `expected ${received} to be a valid URL`,
      pass,
    };
  },
  
  toHaveValidArticleStructure(received) {
    const requiredFields = ['title', 'link', 'state', 'source'];
    const hasAllFields = requiredFields.every(field => 
      received.hasOwnProperty(field) && received[field]
    );
    
    return {
      message: () => `expected article to have all required fields: ${requiredFields.join(', ')}`,
      pass: hasAllFields,
    };
  }
});