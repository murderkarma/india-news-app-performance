const crypto = require('crypto');

/**
 * State-Level Duplicate Detection Utility
 * Prevents duplicate articles within the same state from different sources
 */

/**
 * Normalize text for comparison
 */
function normalizeText(text) {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/['""`''""]/g, '')
    .replace(/^(breaking|urgent|latest|update|news|alert):\s*/i, '')
    .replace(/\s*-\s*(news|update|latest|breaking)$/i, '');
}

/**
 * Calculate similarity between two titles
 */
function calculateTitleSimilarity(title1, title2) {
  const norm1 = normalizeText(title1);
  const norm2 = normalizeText(title2);
  
  if (norm1 === norm2) return 1.0;
  
  const len1 = norm1.length;
  const len2 = norm2.length;
  
  if (len1 === 0 || len2 === 0) return 0.0;
  
  // Simple Levenshtein distance calculation
  const matrix = Array(len1 + 1).fill().map(() => Array(len2 + 1).fill(0));
  
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  return (maxLen - distance) / maxLen;
}

/**
 * Generate content hash for exact duplicate detection
 */
function generateContentHash(article) {
  const content = [
    normalizeText(article.title || ''),
    article.url || ''
  ].join('|');
  
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Check if two articles are duplicates within the same state
 */
function isDuplicateInState(article1, article2, similarityThreshold = 0.85) {
  // Exact URL match
  if (article1.url && article2.url && article1.url === article2.url) {
    return { isDuplicate: true, reason: 'exact_url', confidence: 1.0 };
  }
  
  // Title similarity check
  const similarity = calculateTitleSimilarity(article1.title, article2.title);
  if (similarity >= similarityThreshold) {
    return { isDuplicate: true, reason: 'similar_title', confidence: similarity };
  }
  
  return { isDuplicate: false, confidence: similarity };
}

/**
 * Remove duplicates from articles within the same state
 */
function deduplicateStateArticles(articles, options = {}) {
  const { 
    similarityThreshold = 0.85, 
    logDuplicates = false,
    keepFirst = true 
  } = options;
  
  if (!articles || articles.length === 0) {
    return {
      uniqueArticles: [],
      duplicates: [],
      originalCount: 0,
      uniqueCount: 0,
      duplicateCount: 0
    };
  }
  
  const uniqueArticles = [];
  const duplicates = [];
  const seenHashes = new Set();
  
  for (const article of articles) {
    // First check exact content hash
    const contentHash = generateContentHash(article);
    if (seenHashes.has(contentHash)) {
      duplicates.push({
        duplicate: article,
        reason: 'exact_content',
        confidence: 1.0
      });
      if (logDuplicates) {
        console.log(`🔄 Exact duplicate: "${article.title}"`);
      }
      continue;
    }
    
    // Check similarity with existing unique articles
    let isDuplicate = false;
    let matchedArticle = null;
    let matchReason = '';
    let matchConfidence = 0;
    
    for (const existingArticle of uniqueArticles) {
      const duplicateCheck = isDuplicateInState(article, existingArticle, similarityThreshold);
      if (duplicateCheck.isDuplicate) {
        isDuplicate = true;
        matchedArticle = existingArticle;
        matchReason = duplicateCheck.reason;
        matchConfidence = duplicateCheck.confidence;
        break;
      }
    }
    
    if (isDuplicate) {
      duplicates.push({
        duplicate: article,
        original: matchedArticle,
        reason: matchReason,
        confidence: matchConfidence
      });
      if (logDuplicates) {
        console.log(`🔄 Similar duplicate: "${article.title}" (${matchReason}, confidence: ${matchConfidence.toFixed(2)})`);
      }
    } else {
      uniqueArticles.push(article);
      seenHashes.add(contentHash);
    }
  }
  
  return {
    uniqueArticles,
    duplicates,
    originalCount: articles.length,
    uniqueCount: uniqueArticles.length,
    duplicateCount: duplicates.length
  };
}

/**
 * Check new articles against existing articles in database for the same state
 */
async function checkStateArticlesInDatabase(newArticles, state, Article, options = {}) {
  const { similarityThreshold = 0.85, dayLimit = 7 } = options;
  
  if (!newArticles || newArticles.length === 0) {
    return [];
  }
  
  // Get recent articles from the same state
  const recentArticles = await Article.find({
    state: state,
    createdAt: { $gte: new Date(Date.now() - dayLimit * 24 * 60 * 60 * 1000) }
  }).select('title url contentHash').lean();
  
  const results = [];
  
  for (const newArticle of newArticles) {
    const contentHash = generateContentHash(newArticle);
    let isDuplicate = false;
    let matchedArticle = null;
    let matchReason = '';
    
    // Check against existing articles
    for (const existingArticle of recentArticles) {
      // Exact content hash match
      if (existingArticle.contentHash === contentHash) {
        isDuplicate = true;
        matchedArticle = existingArticle;
        matchReason = 'exact_content';
        break;
      }
      
      // Similarity check
      const duplicateCheck = isDuplicateInState(newArticle, existingArticle, similarityThreshold);
      if (duplicateCheck.isDuplicate) {
        isDuplicate = true;
        matchedArticle = existingArticle;
        matchReason = duplicateCheck.reason;
        break;
      }
    }
    
    results.push({
      article: newArticle,
      isDuplicate,
      existingArticle: matchedArticle,
      reason: matchReason,
      contentHash
    });
  }
  
  return results;
}

module.exports = {
  normalizeText,
  calculateTitleSimilarity,
  generateContentHash,
  isDuplicateInState,
  deduplicateStateArticles,
  checkStateArticlesInDatabase
};