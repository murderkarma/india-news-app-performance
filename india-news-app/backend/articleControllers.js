const Article = require('./articleModel');
const { batchGenerateContent, generateArticleContent } = require('./utils/aiUtils');

const VALID_STATES = [
  'Arunachal Pradesh',
  'Assam',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Sikkim',
  'Tripura'
];

// Get all articles with optional pagination and search
const getAllArticles = async (req, res) => {
  // Reduced logging for performance
  if (process.env.NODE_ENV === 'development') {
    console.log("🔥 Incoming GET /api/news request");
  }
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const query = search
      ? { title: { $regex: search, $options: 'i' } }
      : {};

    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Article.countDocuments(query);

    res.status(200).json({ total, page: parseInt(page), articles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch articles', details: err.message });
  }
};

// Get a single article by ID
const getArticleById = async (req, res) => {
  const { id } = req.params;
  try {
    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.status(200).json(article);
  } catch (err) {
    res.status(500).json({ error: 'Error retrieving article', details: err.message });
  }
};

// Get articles by state
const getArticlesByState = async (req, res) => {
  const { state } = req.params;
  const { page = 1, limit = 10, search = '' } = req.query;

  try {
    const query = {
      state: { $regex: new RegExp(`^${state}$`, 'i') },
      ...(search && { title: { $regex: new RegExp(search, 'i') } })
    };
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 State param:', state);
      console.log('🔍 Query:', query);
    }

    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Article.countDocuments(query);

    res.status(200).json({ total, page: parseInt(page), articles });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch articles for state', details: err.message });
  }
};

// Create a new article with validation and automatic AI enhancement
const createArticle = async (req, res) => {
  const { title, summary, image, link, state } = req.body;

  if (!title || !summary || !link || !state) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!VALID_STATES.includes(state)) {
    return res.status(400).json({ error: `Invalid state: ${state}` });
  }

  try {
    const newArticle = new Article({ title, summary, image, link, state });
    await newArticle.save();
    
    // Automatically enhance with AI in the background (non-blocking)
    enhanceArticleWithAI(newArticle).catch(err => {
      console.error('🤖 Background AI enhancement failed:', err.message);
    });
    
    res.status(201).json(newArticle);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create article', details: err.message });
  }
};

// Update an article
const updateArticle = async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await Article.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
    if (!updated) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.status(200).json(updated);
  } catch (err) {
    res.status(400).json({ error: 'Failed to update article', details: err.message });
  }
};

// Delete an article
const deleteArticle = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await Article.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.status(200).json({ message: 'Article deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete article', details: err.message });
  }
};

// Enhance a single article with AI content (background processing)
const enhanceArticleWithAI = async (article) => {
  try {
    console.log(`🤖 Auto-enhancing article: "${article.title}"`);
    
    const aiContent = await generateArticleContent(article);
    
    await Article.findByIdAndUpdate(
      article._id,
      {
        aiPunchline: aiContent.punchline,
        aiSummary: aiContent.summary,
        originalTitle: article.title,
        aiGenerated: true,
        processedAt: new Date()
      },
      { new: true }
    );
    
    console.log(`✅ Auto-enhanced article: ${article._id}`);
  } catch (error) {
    console.error(`❌ Auto-enhancement failed for article ${article._id}:`, error.message);
  }
};

// Enhance articles with AI content (batch processing endpoint)
const enhanceArticlesWithAI = async (req, res) => {
  try {
    const { state, limit = 10 } = req.query;
    
    // Find articles that haven't been AI-enhanced yet
    const query = {
      aiGenerated: { $ne: true },
      ...(state && { state: { $regex: new RegExp(`^${state}$`, 'i') } })
    };
    
    console.log('🤖 Finding articles to enhance with AI...');
    console.log('🔍 Query:', JSON.stringify(query));
    const articles = await Article.find(query).limit(parseInt(limit));
    
    console.log(`📊 Found ${articles.length} articles to process`);
    if (articles.length > 0) {
      console.log('📝 First article:', {
        id: articles[0]._id,
        title: articles[0].title,
        aiGenerated: articles[0].aiGenerated
      });
    }
    
    if (articles.length === 0) {
      return res.status(200).json({
        message: 'No articles found that need AI enhancement',
        enhanced: 0
      });
    }
    
    console.log(`🚀 Enhancing ${articles.length} articles with AI...`);
    
    // Process articles with AI
    const enhancedArticles = await batchGenerateContent(articles, 3);
    
    // Update articles in database
    const updatePromises = enhancedArticles.map(async (article) => {
      if (article.aiGenerated) {
        console.log(`💾 Updating article ${article._id} with AI content...`);
        const updated = await Article.findByIdAndUpdate(
          article._id,
          {
            aiPunchline: article.aiPunchline,
            aiSummary: article.aiSummary,
            originalTitle: article.originalTitle,
            aiGenerated: true,
            processedAt: article.processedAt
          },
          { new: true }
        );
        console.log(`✅ Updated article ${article._id}:`, {
          aiPunchline: updated.aiPunchline?.substring(0, 30) + '...',
          aiSummary: updated.aiSummary?.substring(0, 30) + '...'
        });
        return updated;
      }
      console.log(`⏭️ Skipping article ${article._id} (aiGenerated: ${article.aiGenerated})`);
      return article;
    });
    
    const updatedArticles = await Promise.all(updatePromises);
    const successCount = updatedArticles.filter(a => a && a.aiGenerated).length;
    
    console.log(`📈 Update results: ${successCount} successful out of ${updatedArticles.length} total`);
    
    console.log(`✅ Successfully enhanced ${successCount} articles`);
    
    res.status(200).json({
      message: `Enhanced ${successCount} articles with AI content`,
      enhanced: successCount,
      total: articles.length,
      articles: updatedArticles
    });
    
  } catch (err) {
    console.error('❌ AI enhancement failed:', err);
    res.status(500).json({
      error: 'Failed to enhance articles with AI',
      details: err.message
    });
  }
};

module.exports = {
  getAllArticles,
  getArticleById,
  getArticlesByState,
  createArticle,
  updateArticle,
  deleteArticle,
  enhanceArticleWithAI,
  enhanceArticlesWithAI,
};
