console.log("newsRoutes.js loaded!");

const express = require('express');
const router = express.Router();
const {
  getAllArticles,
  getArticlesByState,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  enhanceArticlesWithAI,
} = require('./articleControllers');
const { dynamicScrapeHandler } = require('./scrapes/scrapeControllers');


router.get('/ping', (req, res) => {
  console.log('PING ROUTE');
  res.send('pong');
});

// Debug endpoint to check OpenAI API key
router.get('/debug/ai', (req, res) => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const keyLength = process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.length : 0;
  res.json({
    hasApiKey,
    keyLength,
    keyPreview: process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 10) + '...' : 'none'
  });
});


// Scrape news by state dynamically
router.get('/scrape/:state', dynamicScrapeHandler);

// Enhance articles with AI content (specific state or all states)
router.post('/enhance-ai', enhanceArticlesWithAI);

// Enhance all unprocessed articles across all states
router.post('/enhance-ai-all', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    // Find all articles that haven't been AI-enhanced yet
    const query = { aiGenerated: { $ne: true } };
    
    console.log('🤖 Finding all unprocessed articles across all states...');
    const articles = await require('./articleModel').find(query).limit(parseInt(limit));
    
    if (articles.length === 0) {
      return res.status(200).json({
        message: 'All articles are already AI-enhanced!',
        enhanced: 0
      });
    }
    
    console.log(`🚀 Auto-enhancing ${articles.length} articles across all states...`);
    
    // Process articles in background
    articles.forEach(article => {
      require('./articleControllers').enhanceArticleWithAI(article).catch(err => {
        console.error(`🤖 Background AI enhancement failed for article ${article._id}:`, err.message);
      });
    });
    
    res.status(200).json({
      message: `Started AI enhancement for ${articles.length} articles`,
      processing: articles.length,
      note: 'Articles are being enhanced in the background. Check back in a few minutes.'
    });
    
  } catch (err) {
    console.error('❌ Bulk AI enhancement failed:', err);
    res.status(500).json({
      error: 'Failed to start bulk AI enhancement',
      details: err.message
    });
  }
});

// Get popular Northeast articles across all states
router.get('/ne-popular', async (req, res) => {
  try {
    const { sortBy = 'popular', limit = 50, page = 1 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    console.log(`🔥 Fetching Northeast popular articles - Sort: ${sortBy}, Limit: ${limit}, Page: ${page}`);
    
    const neStates = ['assam', 'manipur', 'meghalaya', 'mizoram', 'nagaland', 'tripura', 'arunachal pradesh', 'sikkim'];
    
    let sortCriteria;
    
    if (sortBy === 'recent') {
      // Sort by most recent
      sortCriteria = { scrapedAt: -1, createdAt: -1 };
    } else {
      // Sort by popularity score
      const articles = await require('./articleModel').aggregate([
        {
          $match: {
            state: {
              $in: neStates.map(state => new RegExp(`^${state}$`, 'i'))
            }
          }
        },
        {
          $addFields: {
            popularityScore: {
              $add: [
                // AI-enhanced articles get major boost
                { $cond: [{ $eq: ["$aiGenerated", true] }, 100, 0] },
                // Recent articles get time-based bonus (max 50 points)
                {
                  $max: [
                    0,
                    {
                      $subtract: [
                        50,
                        {
                          $divide: [
                            { $subtract: [new Date(), { $ifNull: ["$scrapedAt", "$createdAt"] }] },
                            86400000 // 24 hours in milliseconds
                          ]
                        }
                      ]
                    }
                  ]
                },
                // Random factor for variety (0-25 points)
                { $multiply: [{ $rand: {} }, 25] }
              ]
            }
          }
        },
        { $sort: { popularityScore: -1, scrapedAt: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },
        {
          $project: {
            title: 1,
            aiPunchline: 1,
            image: 1,
            link: 1,
            state: 1,
            source: 1,
            scrapedAt: 1,
            createdAt: 1,
            aiGenerated: 1,
            popularityScore: 1
          }
        }
      ]);
      
      return res.status(200).json({
        success: true,
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: articles.length === parseInt(limit)
        },
        sortBy: 'popular'
      });
    }
    
    // For recent sorting, use simple find
    const articles = await require('./articleModel')
      .find({
        state: {
          $in: neStates.map(state => new RegExp(`^${state}$`, 'i'))
        }
      })
      .select('title aiPunchline image link state source scrapedAt createdAt aiGenerated')
      .sort(sortCriteria)
      .skip(skip)
      .limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      articles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: articles.length === parseInt(limit)
      },
      sortBy
    });
    
  } catch (err) {
    console.error('❌ Failed to fetch Northeast popular articles:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Northeast articles',
      details: err.message
    });
  }
});

// Get all articles with optional pagination and search
router.get('/', getAllArticles);

// Get articles by state (e.g., ?state=Manipur)
router.get('/state/:state', getArticlesByState);

// Direct state route for frontend compatibility
router.get('/:state', getArticlesByState);

// Get a single article by ID (this should be last to avoid conflicts)
router.get('/article/:id', getArticleById);

// Create a new article
router.post('/', createArticle);

// Update an article by ID
router.put('/:id', updateArticle);

// Delete an article by ID
router.delete('/:id', deleteArticle);


module.exports = router; 