/**
 * Test script for AI Utils
 * Demonstrates how to use the AI content generation utilities
 */

const { generateArticleContent, batchGenerateContent, enhancedArticleProcessing } = require('../utils/aiUtils');

// Sample article data for testing
const sampleArticles = [
  {
    title: "Assam Tea Gardens Face Water Shortage Due to Delayed Monsoon",
    body: "Tea gardens across Assam are experiencing severe water shortage as the monsoon has been delayed by three weeks. The Assam Tea Association has reported that over 200 tea estates are affected, with production expected to drop by 15% this season. Garden workers are concerned about their livelihoods as the drought continues to impact the region's primary industry.",
    source: "EastMojo",
    state: "Assam",
    link: "https://example.com/assam-tea-shortage"
  },
  {
    title: "Manipur Classical Dance Festival Attracts International Performers",
    body: "The annual Manipur Classical Dance Festival has begun in Imphal with participants from over 12 countries. The five-day event showcases traditional Manipuri dance forms including Raas Leela and Thang-Ta martial arts. Cultural enthusiasts and tourists have gathered to witness this celebration of Northeast India's rich artistic heritage.",
    source: "Northeast Today",
    state: "Manipur",
    link: "https://example.com/manipur-dance-festival"
  },
  {
    title: "Meghalaya's Living Root Bridges Get UNESCO Recognition Proposal",
    body: "The Government of Meghalaya has submitted a proposal to UNESCO for recognizing the state's living root bridges as a World Heritage Site. These unique bio-engineering marvels, created by the Khasi and Jaintia tribes, represent centuries of indigenous knowledge and sustainable architecture. The proposal highlights 11 major root bridge sites across the state.",
    source: "Shillong Times",
    state: "Meghalaya",
    link: "https://example.com/meghalaya-unesco-bridges"
  }
];

/**
 * Test single article processing
 */
async function testSingleArticle() {
  console.log('\n🧪 Testing Single Article Processing...\n');
  
  try {
    const article = sampleArticles[0];
    console.log('Original Article:');
    console.log(`Title: ${article.title}`);
    console.log(`State: ${article.state}`);
    console.log(`Body: ${article.body.substring(0, 100)}...\n`);
    
    const result = await generateArticleContent(article);
    
    console.log('AI Generated Content:');
    console.log(`Punchline: ${result.punchline}`);
    console.log(`Summary: ${result.summary}\n`);
    
    return result;
  } catch (error) {
    console.error('❌ Single article test failed:', error.message);
    return null;
  }
}

/**
 * Test batch processing
 */
async function testBatchProcessing() {
  console.log('\n🧪 Testing Batch Processing...\n');
  
  try {
    console.log(`Processing ${sampleArticles.length} articles in batch...\n`);
    
    const results = await batchGenerateContent(sampleArticles, 2);
    
    results.forEach((article, index) => {
      console.log(`--- Article ${index + 1} ---`);
      console.log(`Original: ${article.originalTitle || article.title}`);
      console.log(`Punchline: ${article.title}`);
      console.log(`Summary: ${article.summary}`);
      console.log(`AI Generated: ${article.aiGenerated}`);
      console.log('');
    });
    
    return results;
  } catch (error) {
    console.error('❌ Batch processing test failed:', error.message);
    return [];
  }
}

/**
 * Test enhanced processing with different tones
 */
async function testEnhancedProcessing() {
  console.log('\n🧪 Testing Enhanced Processing with Different Tones...\n');
  
  const article = sampleArticles[1]; // Manipur dance festival
  const tones = ['casual', 'formal', 'urgent'];
  
  for (const tone of tones) {
    try {
      console.log(`--- Testing ${tone.toUpperCase()} tone ---`);
      
      const result = await enhancedArticleProcessing(article, {
        tone: tone,
        includeStateContext: true
      });
      
      console.log(`Punchline: ${result.punchline}`);
      console.log(`Summary: ${result.summary}\n`);
      
    } catch (error) {
      console.error(`❌ Enhanced processing failed for ${tone} tone:`, error.message);
    }
  }
}

/**
 * Test fallback behavior (simulate API failure)
 */
async function testFallbackBehavior() {
  console.log('\n🧪 Testing Fallback Behavior...\n');
  
  // Temporarily break the OpenAI API key to test fallback
  const originalApiKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'invalid-key';
  
  try {
    const article = sampleArticles[2];
    console.log('Testing with invalid API key (should trigger fallback)...\n');
    
    const result = await generateArticleContent(article);
    
    console.log('Fallback Result:');
    console.log(`Punchline: ${result.punchline}`);
    console.log(`Summary: ${result.summary}\n`);
    
  } catch (error) {
    console.error('❌ Fallback test failed:', error.message);
  } finally {
    // Restore original API key
    process.env.OPENAI_API_KEY = originalApiKey;
  }
}

/**
 * Performance test
 */
async function testPerformance() {
  console.log('\n🧪 Testing Performance...\n');
  
  try {
    const startTime = Date.now();
    
    // Process all articles
    const results = await batchGenerateContent(sampleArticles);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`Performance Results:`);
    console.log(`Articles processed: ${results.length}`);
    console.log(`Total time: ${duration}ms`);
    console.log(`Average time per article: ${Math.round(duration / results.length)}ms`);
    console.log(`Successful AI generations: ${results.filter(r => r.aiGenerated).length}`);
    
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🚀 Starting AI Utils Test Suite...');
  console.log('=====================================');
  
  // Check if OpenAI API key is set
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OPENAI_API_KEY not set. Some tests will use fallback behavior.');
    console.log('To test full functionality, add OPENAI_API_KEY to your .env file.\n');
  }
  
  try {
    await testSingleArticle();
    await testBatchProcessing();
    await testEnhancedProcessing();
    await testFallbackBehavior();
    await testPerformance();
    
    console.log('✅ All tests completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }
}

// Export for use in other files
module.exports = {
  testSingleArticle,
  testBatchProcessing,
  testEnhancedProcessing,
  testFallbackBehavior,
  testPerformance,
  runAllTests,
  sampleArticles
};

// Run tests if this file is executed directly
if (require.main === module) {
  // Load environment variables
  require('dotenv').config();
  
  runAllTests()
    .then(() => {
      console.log('\n🏁 Test suite finished.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite crashed:', error);
      process.exit(1);
    });
}