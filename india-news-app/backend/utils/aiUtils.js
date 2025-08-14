const OpenAI = require('openai');

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Initialize OpenAI client with error handling
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  } else {
    console.warn('⚠️ OPENAI_API_KEY not found. AI features will use fallback behavior.');
  }
} catch (error) {
  console.warn('⚠️ Failed to initialize OpenAI client:', error.message);
}

/**
 * Generates a punchy headline and summary for a news article
 * @param {Object} article - The raw article object
 * @param {string} article.title - Original article title
 * @param {string} article.body - Article body content (optional)
 * @param {string} article.source - Article source (optional)
 * @param {string} article.state - Indian state the article is about
 * @returns {Promise<Object>} - Returns { punchline, summary }
 */
async function generateArticleContent(article) {
  try {
    const { title, body = '', source = '', state } = article;
    
    // Check if OpenAI is available
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }
    
    // Prepare the prompt for OpenAI
    const prompt = `
You are a sharp, witty content creator writing punchy headlines for a mobile-first Gen Z & Millennial audience in Northeast India. Your job is to make local news feel viral, emotional, and instantly clickable — without being clickbait. Capture regional pride, hidden stories, or shocking turns — in a headline short enough to fit on a smartphone lock screen.

Original Title: "${title}" (may be in a regional language)
State: ${state}
Source: ${source}
${body ? `Content: ${body.substring(0, 1000)}...` : ''}

HEADLINE GUIDELINES:
- Bold, emotionally charged language - short, sharp, memorable
- Light wordplay, pop culture tones, urgency when appropriate
- Examples: "Finally!", "Hidden Gem", "21 Years Later...", "No One Saw This Coming"
- Mobile-first: 1-line max, 8-12 words max
- Hook like a viral tweet — emotional, clever, but grounded in truth
- Smart Twitter headline meets Apple News style
- Target Gen Z curiosity + Millennial relevance

TONE EXAMPLES I LOVE:
• "Hoppy News! Assam's Secret Frog Species Finally Found"
• "21 Years Later, Assam's Forests Drop a Bombshell"u
• "No One Saw This Coming from Guwahati's Jungles"
• "Northeast India's Silent Star Finally Gets Its Spotlight"

Generate:
1. A punchy, emotionally grabbing headline (max 60 characters) using this exact style
2. A concise 2-3 sentence summary that captures the key points

Focus on:
- Emotional hooks: surprise, discovery, breakthrough, hidden secrets
- Time elements: "Finally", "After X Years", "At Last"
- Location pride: "${state}'s Hidden...", "Northeast India's..."
- Curiosity gaps: "No One Expected...", "The Secret Behind..."
- Power words: bombshell, breakthrough, hidden, secret, finally, shocking, game-changer
Be bold and emotional, but never misleading. Accuracy must remain.

Respond in this exact JSON format:
{
  "punchline": "Your punchy headline here",
  "summary": "Your 2-3 sentence summary here."
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are an expert content creator for Indian regional news. Always respond with valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    const response = completion.choices[0].message.content.trim();
    
    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(response);
    } catch (parseError) {
      console.warn('Failed to parse OpenAI response as JSON:', response);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Validate the response structure
    if (!result.punchline || !result.summary) {
      throw new Error('Missing required fields in OpenAI response');
    }

    // Ensure punchline isn't too long (mobile-first: 8-12 words max)
    if (result.punchline.length > 60) {
      result.punchline = result.punchline.substring(0, 57) + '...';
    }

    return {
      punchline: result.punchline,
      summary: result.summary
    };

  } catch (error) {
    console.error('AI content generation failed:', error.message);
    
    // Fallback behavior - use original title and create basic summary
    return {
      punchline: article.title || 'Breaking News from ' + article.state,
      summary: article.body
        ? article.body.substring(0, 200) + '...'
        : `Latest news update from ${article.state}. Read more for details.`
    };
  }
}

/**
 * Batch process multiple articles for AI content generation
 * @param {Array} articles - Array of article objects
 * @param {number} batchSize - Number of articles to process concurrently (default: 3)
 * @returns {Promise<Array>} - Array of articles with AI-generated content
 */
async function batchGenerateContent(articles, batchSize = 3) {
  const results = [];
  
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (article, index) => {
      try {
        console.log(`🔄 Processing article ${i + index + 1}: "${article.title}"`);
        const aiContent = await generateArticleContent(article);
        console.log(`✅ AI content generated for article ${i + index + 1}:`, {
          punchline: aiContent.punchline?.substring(0, 50) + '...',
          summary: aiContent.summary?.substring(0, 50) + '...'
        });
        return {
          ...article.toObject(), // Convert mongoose document to plain object
          aiPunchline: aiContent.punchline, // Store AI punchline separately
          aiSummary: aiContent.summary,     // Store AI summary separately
          originalTitle: article.title,    // Keep original for reference
          aiGenerated: true,
          processedAt: new Date()
        };
      } catch (error) {
        console.error(`❌ Failed to process article ${i + index + 1}:`, error.message);
        return {
          ...article,
          aiGenerated: false,
          error: error.message
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add a small delay between batches to respect API rate limits
    if (i + batchSize < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

/**
 * Enhanced article processing with state-specific context
 * @param {Object} article - Article object
 * @param {Object} options - Processing options
 * @param {boolean} options.includeStateContext - Add state-specific cultural context
 * @param {string} options.tone - Tone preference ('casual', 'formal', 'urgent')
 * @returns {Promise<Object>} - Enhanced article with AI content
 */
async function enhancedArticleProcessing(article, options = {}) {
  const { includeStateContext = true, tone = 'casual' } = options;
  
  // State-specific context mapping
  const stateContext = {
    'Assam': 'tea gardens, Brahmaputra river, one-horned rhinos, Bihu festival',
    'Manipur': 'Loktak Lake, classical dance, martial arts, sports culture',
    'Meghalaya': 'living root bridges, wettest place on earth, tribal culture',
    'Mizoram': 'bamboo forests, hill tribes, festivals',
    'Nagaland': 'Hornbill festival, tribal heritage, warrior culture',
    'Arunachal Pradesh': 'sunrise state, monasteries, diverse tribes',
    'Tripura': 'royal palaces, fourteen gods, traditional crafts',
    'Sikkim': 'Kanchenjunga, organic farming, Buddhist culture'
  };

  const contextInfo = includeStateContext && stateContext[article.state] 
    ? `\nState Context: ${article.state} is known for ${stateContext[article.state]}.`
    : '';

  const toneInstructions = {
    'casual': 'Use a friendly, conversational tone that feels like talking to a friend.',
    'formal': 'Use a professional, news-style tone appropriate for serious journalism.',
    'urgent': 'Use an urgent, attention-grabbing tone for breaking news.'
  };

  const enhancedArticle = {
    ...article,
    contextInfo,
    tone: toneInstructions[tone]
  };

  return await generateArticleContent(enhancedArticle);
}

module.exports = {
  generateArticleContent,
  batchGenerateContent,
  enhancedArticleProcessing
};