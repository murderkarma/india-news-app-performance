/**
 * AI Configuration for News Content Generation
 * Centralized settings for OpenAI integration and content processing
 */

const AI_CONFIG = {
  // OpenAI Settings
  openai: {
    model: 'gpt-3.5-turbo',
    maxTokens: 300,
    temperature: 0.7,
    timeout: 30000, // 30 seconds
  },

  // Content Generation Settings
  content: {
    maxHeadlineLength: 80,
    maxSummaryLength: 300,
    batchSize: 3, // Number of articles to process concurrently
    batchDelay: 1000, // Delay between batches in milliseconds
  },

  // Rate Limiting
  rateLimits: {
    requestsPerMinute: 20,
    requestsPerHour: 1000,
    retryAttempts: 3,
    retryDelay: 2000, // Base delay for exponential backoff
  },

  // Fallback Settings
  fallback: {
    enabled: true,
    useOriginalTitle: true,
    generateBasicSummary: true,
    maxBodyLength: 200,
  },

  // State-specific prompts and context
  stateContext: {
    'Assam': {
      keywords: ['tea gardens', 'Brahmaputra', 'rhinos', 'Bihu', 'Kaziranga'],
      culturalContext: 'tea gardens, Brahmaputra river, one-horned rhinos, Bihu festival',
      tone: 'warm and community-focused'
    },
    'Manipur': {
      keywords: ['Loktak Lake', 'classical dance', 'martial arts', 'sports'],
      culturalContext: 'Loktak Lake, classical dance, martial arts, sports culture',
      tone: 'artistic and athletic'
    },
    'Meghalaya': {
      keywords: ['living root bridges', 'rainfall', 'tribal culture', 'hills'],
      culturalContext: 'living root bridges, wettest place on earth, tribal culture',
      tone: 'mystical and nature-focused'
    },
    'Mizoram': {
      keywords: ['bamboo forests', 'hill tribes', 'festivals', 'culture'],
      culturalContext: 'bamboo forests, hill tribes, festivals',
      tone: 'traditional and festive'
    },
    'Nagaland': {
      keywords: ['Hornbill festival', 'tribal heritage', 'warrior culture'],
      culturalContext: 'Hornbill festival, tribal heritage, warrior culture',
      tone: 'proud and traditional'
    },
    'Arunachal Pradesh': {
      keywords: ['sunrise state', 'monasteries', 'diverse tribes', 'mountains'],
      culturalContext: 'sunrise state, monasteries, diverse tribes',
      tone: 'spiritual and diverse'
    },
    'Tripura': {
      keywords: ['royal palaces', 'fourteen gods', 'traditional crafts'],
      culturalContext: 'royal palaces, fourteen gods, traditional crafts',
      tone: 'royal and traditional'
    },
    'Sikkim': {
      keywords: ['Kanchenjunga', 'organic farming', 'Buddhist culture'],
      culturalContext: 'Kanchenjunga, organic farming, Buddhist culture',
      tone: 'peaceful and organic'
    }
  },

  // Content tone options
  tones: {
    casual: 'Use a friendly, conversational tone that feels like talking to a friend.',
    formal: 'Use a professional, news-style tone appropriate for serious journalism.',
    urgent: 'Use an urgent, attention-grabbing tone for breaking news.',
    engaging: 'Use an engaging, social media style tone that encourages interaction.'
  },

  // Prompt templates
  prompts: {
    headline: `Create a punchy, engaging headline (max {maxLength} characters) that would work well on social media or Reddit. Make it clickable and relevant to {state} residents.`,
    
    summary: `Write a concise 2-3 sentence summary that captures the key points of this article. Focus on what matters most to people in {state}.`,
    
    combined: `Transform this news article into engaging content for a mobile news app targeting {state} residents.

Original Title: "{title}"
State: {state}
Source: {source}
{bodyText}

Generate:
1. A punchy, engaging headline (max {maxHeadlineLength} characters) - should be catchy and clickable
2. A concise 2-3 sentence summary that captures the key points

Context: {state} is known for {stateContext}.
Tone: {tone}

Respond in this exact JSON format:
{
  "punchline": "Your punchy headline here",
  "summary": "Your 2-3 sentence summary here."
}`
  }
};

module.exports = AI_CONFIG;