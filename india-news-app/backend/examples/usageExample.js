/**
 * Usage Example: AI Content Generation for India News App
 * 
 * This example demonstrates how to integrate the AI utility
 * into your scraping pipeline for any Indian state.
 */

require('dotenv').config();
const { generateArticleContent, batchGenerateContent } = require('../utils/aiUtils');
const Article = require('../articleModel');

/**
 * Example 1: Process a single article
 */
async function exampleSingleArticle() {
  console.log('\n📰 Example 1: Single Article Processing\n');
  
  const rawArticle = {
    title: "Assam Government Announces New Tea Garden Welfare Scheme",
    body: "The Assam government has announced a comprehensive welfare scheme for tea garden workers, providing healthcare benefits, education support for children, and housing assistance. The scheme will benefit over 1 million tea garden workers across the state and is expected to improve living conditions significantly.",
    state: "Assam",
    source: "EastMojo",
    link: "https://example.com/assam-tea-welfare"
  };

  try {
    console.log('Original Article:');
    console.log(`Title: ${rawArticle.title}`);
    console.log(`State: ${rawArticle.state}\n`);

    // Generate AI content
    const aiContent = await generateArticleContent(rawArticle);
    
    console.log('AI-Generated Content:');
    console.log(`Punchline: ${aiContent.punchline}`);
    console.log(`Summary: ${aiContent.summary}\n`);
    
    // This is what you'd save to your database
    const enhancedArticle = {
      ...rawArticle,
      title: aiContent.punchline,        // Use AI punchline as title
      summary: aiContent.summary,        // Use AI summary
      originalTitle: rawArticle.title,   // Keep original for reference
      aiGenerated: true,
      processedAt: new Date()
    };
    
    console.log('Ready for database:', enhancedArticle);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

/**
 * Example 2: Batch process multiple articles (typical scraper workflow)
 */
async function exampleBatchProcessing() {
  console.log('\n📰 Example 2: Batch Processing (Scraper Integration)\n');
  
  // Simulate scraped articles from different states
  const scrapedArticles = [
    {
      title: "Manipur Wins National Football Championship",
      body: "Manipur's football team has won the national championship for the third consecutive year, defeating Kerala 2-1 in the final match held in New Delhi.",
      state: "Manipur",
      source: "Northeast Today",
      link: "https://example.com/manipur-football"
    },
    {
      title: "Meghalaya Receives Heavy Rainfall, Flood Alert Issued",
      body: "The meteorological department has issued a flood alert for several districts in Meghalaya following heavy rainfall. Residents in low-lying areas have been advised to move to safer locations.",
      state: "Meghalaya",
      source: "Shillong Times",
      link: "https://example.com/meghalaya-floods"
    },
    {
      title: "Nagaland Hornbill Festival Attracts Record Visitors",
      body: "This year's Hornbill Festival in Nagaland has attracted a record number of visitors, with over 200,000 tourists attending the cultural extravaganza showcasing the state's rich tribal heritage.",
      state: "Nagaland",
      source: "Morung Express",
      link: "https://example.com/nagaland-hornbill"
    }
  ];

  try {
    console.log(`Processing ${scrapedArticles.length} articles...\n`);
    
    // Process all articles with AI
    const enhancedArticles = await batchGenerateContent(scrapedArticles, 2);
    
    // Display results
    enhancedArticles.forEach((article, index) => {
      console.log(`--- Article ${index + 1} (${article.state}) ---`);
      console.log(`Original: ${article.originalTitle}`);
      console.log(`Punchline: ${article.title}`);
      console.log(`Summary: ${article.summary}`);
      console.log(`AI Generated: ${article.aiGenerated ? '✅' : '❌'}`);
      console.log('');
    });
    
    return enhancedArticles;
    
  } catch (error) {
    console.error('❌ Batch processing error:', error.message);
    return [];
  }
}

/**
 * Example 3: Complete scraper integration workflow
 */
async function exampleScraperIntegration() {
  console.log('\n📰 Example 3: Complete Scraper Integration\n');
  
  try {
    // Step 1: Simulate scraping (this would be your actual scraping logic)
    console.log('🕷️ Step 1: Scraping articles...');
    const rawArticles = [
      {
        title: "Sikkim Becomes First Organic State in India",
        body: "Sikkim has achieved the milestone of becoming India's first fully organic state, with all agricultural land converted to organic farming practices.",
        state: "Sikkim",
        source: "Sikkim Express",
        link: "https://example.com/sikkim-organic"
      }
    ];
    console.log(`Found ${rawArticles.length} articles\n`);
    
    // Step 2: Generate AI content
    console.log('🤖 Step 2: Generating AI content...');
    const aiEnhancedArticles = await batchGenerateContent(rawArticles);
    console.log(`AI processed ${aiEnhancedArticles.filter(a => a.aiGenerated).length} articles\n`);
    
    // Step 3: Save to database (simulated)
    console.log('💾 Step 3: Saving to database...');
    for (const article of aiEnhancedArticles) {
      // This is how you'd actually save to MongoDB
      const savedArticle = {
        title: article.title,              // AI punchline
        summary: article.summary,          // AI summary  
        image: article.image,
        link: article.link,
        state: article.state,
        originalTitle: article.originalTitle,
        aiGenerated: article.aiGenerated,
        processedAt: article.processedAt,
        source: article.source,
        createdAt: new Date()
      };
      
      console.log(`Saved: ${savedArticle.title}`);
      
      // Actual database save would be:
      // await Article.findOneAndUpdate(
      //   { link: savedArticle.link },
      //   savedArticle,
      //   { upsert: true }
      // );
    }
    
    console.log('\n✅ Scraper integration complete!');
    
  } catch (error) {
    console.error('❌ Integration error:', error.message);
  }
}

/**
 * Example 4: Error handling and fallback behavior
 */
async function exampleErrorHandling() {
  console.log('\n📰 Example 4: Error Handling & Fallback\n');
  
  // Test with invalid API key to demonstrate fallback
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'invalid-key-for-testing';
  
  const article = {
    title: "Tripura Palace Restoration Project Begins",
    body: "The restoration of the historic Ujjayanta Palace in Tripura has begun with support from the Archaeological Survey of India.",
    state: "Tripura",
    source: "Tripura Times",
    link: "https://example.com/tripura-palace"
  };
  
  try {
    console.log('Testing with invalid API key (should trigger fallback)...\n');
    
    const result = await generateArticleContent(article);
    
    console.log('Fallback Result:');
    console.log(`Punchline: ${result.punchline}`);
    console.log(`Summary: ${result.summary}`);
    console.log('\n✅ Fallback behavior working correctly!');
    
  } catch (error) {
    console.error('❌ Error handling test failed:', error.message);
  } finally {
    // Restore original API key
    process.env.OPENAI_API_KEY = originalKey;
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('🚀 AI Utils Usage Examples');
  console.log('============================');
  
  if (!process.env.OPENAI_API_KEY) {
    console.log('\n⚠️ OPENAI_API_KEY not found in environment variables.');
    console.log('Add your OpenAI API key to .env file for full functionality.\n');
  }
  
  try {
    await exampleSingleArticle();
    await exampleBatchProcessing();
    await exampleScraperIntegration();
    await exampleErrorHandling();
    
    console.log('\n🎉 All examples completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Add your OpenAI API key to .env file');
    console.log('2. Integrate AI utility into your scrapers');
    console.log('3. Test with real news sources');
    console.log('4. Set up scheduled scraping for all states');
    
  } catch (error) {
    console.error('\n💥 Examples failed:', error.message);
  }
}

// Export for use in other files
module.exports = {
  exampleSingleArticle,
  exampleBatchProcessing,
  exampleScraperIntegration,
  exampleErrorHandling,
  runExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Examples crashed:', error);
      process.exit(1);
    });
}