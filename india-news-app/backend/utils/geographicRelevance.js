const OpenAI = require('openai');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Initialize OpenAI client
let openai = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
} catch (error) {
  console.warn('⚠️ Failed to initialize OpenAI client for geographic relevance:', error.message);
}

// Northeast states and their key identifiers
const NORTHEAST_STATES = {
  'Assam': {
    keywords: ['assam', 'guwahati', 'dispur', 'brahmaputra', 'kaziranga', 'kamrup', 'jorhat', 'silchar', 'dibrugarh', 'tezpur', 'nagaon', 'barpeta', 'goalpara', 'dhubri', 'bongaigaon'],
    districts: ['kamrup', 'jorhat', 'silchar', 'dibrugarh', 'tezpur', 'nagaon', 'barpeta', 'goalpara', 'dhubri', 'bongaigaon', 'sonitpur', 'lakhimpur', 'dhemaji', 'tinsukia', 'sivasagar', 'golaghat', 'karbi anglong', 'dima hasao'],
    landmarks: ['kaziranga', 'manas', 'brahmaputra', 'kamakhya', 'majuli', 'haflong']
  },
  'Manipur': {
    keywords: ['manipur', 'imphal', 'loktak', 'churachandpur', 'thoubal', 'bishnupur', 'senapati', 'ukhrul', 'chandel', 'tamenglong'],
    districts: ['imphal east', 'imphal west', 'churachandpur', 'thoubal', 'bishnupur', 'senapati', 'ukhrul', 'chandel', 'tamenglong', 'kangpokpi', 'tengnoupal', 'kamjong', 'noney', 'pherzawl', 'jiribam', 'kakching'],
    landmarks: ['loktak lake', 'kangla', 'keibul lamjao', 'dzukou valley']
  },
  'Meghalaya': {
    keywords: ['meghalaya', 'shillong', 'cherrapunji', 'mawsynram', 'tura', 'jowai', 'nongpoh', 'baghmara', 'williamnagar'],
    districts: ['east khasi hills', 'west khasi hills', 'south west khasi hills', 'ri bhoi', 'east garo hills', 'west garo hills', 'south garo hills', 'north garo hills', 'south west garo hills', 'east jaintia hills', 'west jaintia hills'],
    landmarks: ['cherrapunji', 'mawsynram', 'living root bridges', 'elephant falls', 'umiam lake', 'dawki', 'mawlynnong']
  },
  'Mizoram': {
    keywords: ['mizoram', 'aizawl', 'lunglei', 'champhai', 'serchhip', 'kolasib', 'lawngtlai', 'mamit', 'saiha'],
    districts: ['aizawl', 'lunglei', 'champhai', 'serchhip', 'kolasib', 'lawngtlai', 'mamit', 'saiha', 'hnahthial', 'saitual', 'khawzawl'],
    landmarks: ['blue mountain', 'phawngpui', 'vantawng falls', 'reiek']
  },
  'Nagaland': {
    keywords: ['nagaland', 'kohima', 'dimapur', 'mokokchung', 'tuensang', 'mon', 'wokha', 'zunheboto', 'phek', 'kiphire', 'longleng', 'peren'],
    districts: ['kohima', 'dimapur', 'mokokchung', 'tuensang', 'mon', 'wokha', 'zunheboto', 'phek', 'kiphire', 'longleng', 'peren', 'noklak', 'shamator', 'tseminyu', 'niuland', 'chumukedima'],
    landmarks: ['hornbill festival', 'dzukou valley', 'japfu peak', 'mount saramati']
  },
  'Arunachal Pradesh': {
    keywords: ['arunachal pradesh', 'itanagar', 'naharlagun', 'pasighat', 'along', 'bomdila', 'tawang', 'ziro', 'tezu', 'changlang', 'khonsa', 'seppa', 'roing', 'anini', 'hawai', 'daporijo', 'basar', 'koloriang', 'yingkiong'],
    districts: ['tawang', 'west kameng', 'east kameng', 'papum pare', 'kurung kumey', 'kra daadi', 'lower subansiri', 'upper subansiri', 'west siang', 'east siang', 'siang', 'upper siang', 'lower siang', 'lower dibang valley', 'dibang valley', 'anjaw', 'lohit', 'namsai', 'changlang', 'tirap', 'longding'],
    landmarks: ['tawang monastery', 'sela pass', 'bumla pass', 'namdapha', 'ziro valley', 'mechuka', 'roing']
  },
  'Tripura': {
    keywords: ['tripura', 'agartala', 'dharmanagar', 'kailashahar', 'ambassa', 'belonia', 'khowai', 'teliamura', 'sonamura', 'sabroom', 'udaipur', 'amarpur', 'ranirbazar', 'kamalpur', 'kumarghat'],
    districts: ['west tripura', 'south tripura', 'dhalai', 'north tripura', 'khowai', 'gomati', 'unakoti', 'sepahijala'],
    landmarks: ['ujjayanta palace', 'neermahal', 'sepahijala', 'clouded leopard national park']
  },
  'Sikkim': {
    keywords: ['sikkim', 'gangtok', 'namchi', 'gyalshing', 'mangan', 'pelling', 'yuksom', 'lachung', 'lachen', 'ravangla'],
    districts: ['east sikkim', 'west sikkim', 'north sikkim', 'south sikkim'],
    landmarks: ['kanchenjunga', 'nathu la', 'tsomgo lake', 'gurudongmar lake', 'yumthang valley', 'rumtek monastery']
  }
};

/**
 * Analyze article content to determine geographic relevance
 * @param {Object} article - Article object with title, summary, content
 * @param {string} proposedState - The state the article is proposed to be assigned to
 * @returns {Promise<Object>} - Geographic relevance analysis
 */
async function analyzeGeographicRelevance(article, proposedState) {
  try {
    const { title, summary = '', content = '', source = '' } = article;
    const fullText = `${title} ${summary} ${content}`.toLowerCase();
    
    // Step 1: Keyword-based analysis
    const keywordAnalysis = performKeywordAnalysis(fullText, proposedState);
    
    // Step 2: AI-based geographic analysis (if OpenAI is available)
    let aiAnalysis = null;
    if (openai) {
      try {
        aiAnalysis = await performAIGeographicAnalysis(article, proposedState);
      } catch (aiError) {
        console.warn(`⚠️ AI geographic analysis failed: ${aiError.message}`);
      }
    }
    
    // Step 3: Combine analyses to make final decision
    const finalDecision = combineAnalyses(keywordAnalysis, aiAnalysis, proposedState);
    
    return {
      isRelevant: finalDecision.isRelevant,
      confidence: finalDecision.confidence,
      recommendedState: finalDecision.recommendedState,
      reason: finalDecision.reason,
      keywordAnalysis,
      aiAnalysis,
      proposedState
    };
    
  } catch (error) {
    console.error('Geographic relevance analysis failed:', error.message);
    // Default to accepting the proposed state with low confidence
    return {
      isRelevant: true,
      confidence: 0.3,
      recommendedState: proposedState,
      reason: 'Analysis failed, defaulting to source assignment',
      error: error.message
    };
  }
}

/**
 * Perform keyword-based geographic analysis
 */
function performKeywordAnalysis(fullText, proposedState) {
  const stateScores = {};
  
  // Score each state based on keyword matches
  Object.entries(NORTHEAST_STATES).forEach(([stateName, stateData]) => {
    let score = 0;
    let matches = [];
    
    // Check keywords
    stateData.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const keywordMatches = fullText.match(regex);
      if (keywordMatches) {
        score += keywordMatches.length * 2; // Keywords get higher weight
        matches.push(...keywordMatches);
      }
    });
    
    // Check districts
    stateData.districts.forEach(district => {
      const regex = new RegExp(`\\b${district}\\b`, 'gi');
      const districtMatches = fullText.match(regex);
      if (districtMatches) {
        score += districtMatches.length * 3; // Districts get highest weight
        matches.push(...districtMatches);
      }
    });
    
    // Check landmarks
    stateData.landmarks.forEach(landmark => {
      const regex = new RegExp(`\\b${landmark}\\b`, 'gi');
      const landmarkMatches = fullText.match(regex);
      if (landmarkMatches) {
        score += landmarkMatches.length * 2.5; // Landmarks get high weight
        matches.push(...landmarkMatches);
      }
    });
    
    if (score > 0) {
      stateScores[stateName] = { score, matches: [...new Set(matches)] };
    }
  });
  
  // Find the highest scoring state
  const sortedStates = Object.entries(stateScores)
    .sort(([,a], [,b]) => b.score - a.score);
  
  const topState = sortedStates[0];
  const proposedStateScore = stateScores[proposedState];
  
  return {
    allScores: stateScores,
    topState: topState ? topState[0] : null,
    topScore: topState ? topState[1].score : 0,
    topMatches: topState ? topState[1].matches : [],
    proposedStateScore: proposedStateScore ? proposedStateScore.score : 0,
    proposedStateMatches: proposedStateScore ? proposedStateScore.matches : [],
    isProposedStateTop: topState && topState[0] === proposedState
  };
}

/**
 * Perform AI-based geographic analysis using OpenAI
 */
async function performAIGeographicAnalysis(article, proposedState) {
  if (!openai) {
    throw new Error('OpenAI not available');
  }
  
  const { title, summary = '', content = '' } = article;
  
  const prompt = `
Analyze this news article to determine its geographic relevance to Northeast Indian states.

Article Title: "${title}"
Summary: "${summary}"
Content: "${content.substring(0, 1000)}"
Proposed State: ${proposedState}

Northeast States: Assam, Manipur, Meghalaya, Mizoram, Nagaland, Arunachal Pradesh, Tripura, Sikkim

Instructions:
1. Identify the PRIMARY geographic location where the event/news occurred
2. Determine if the article is specifically relevant to the proposed state
3. Check if this is a regional/multi-state event that shouldn't be assigned to individual states
4. Look for specific place names, districts, landmarks, or local context

Respond in this exact JSON format:
{
  "primaryLocation": "State name or 'Regional' or 'Unclear'",
  "isRelevantToProposed": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of your analysis",
  "isRegionalEvent": true/false,
  "specificLocations": ["list", "of", "specific", "places", "mentioned"]
}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a geographic analysis expert for Northeast Indian news. Always respond with valid JSON only."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    max_tokens: 300,
    temperature: 0.3,
  });

  const response = completion.choices[0].message.content.trim();
  
  try {
    return JSON.parse(response);
  } catch (parseError) {
    console.warn('Failed to parse AI geographic analysis response:', response);
    throw new Error('Invalid JSON response from AI geographic analysis');
  }
}

/**
 * Combine keyword and AI analyses to make final decision
 */
function combineAnalyses(keywordAnalysis, aiAnalysis, proposedState) {
  let isRelevant = true;
  let confidence = 0.5;
  let recommendedState = proposedState;
  let reason = 'Default assignment';
  
  // If we have keyword analysis
  if (keywordAnalysis.topState) {
    if (keywordAnalysis.isProposedStateTop) {
      // Proposed state matches keyword analysis
      isRelevant = true;
      confidence = Math.min(0.9, 0.6 + (keywordAnalysis.proposedStateScore / 10));
      recommendedState = proposedState;
      reason = `Strong keyword match for ${proposedState}: ${keywordAnalysis.proposedStateMatches.join(', ')}`;
    } else if (keywordAnalysis.proposedStateScore === 0) {
      // No keywords found for proposed state, but found for another state
      isRelevant = false;
      confidence = Math.min(0.9, 0.6 + (keywordAnalysis.topScore / 10));
      recommendedState = keywordAnalysis.topState;
      reason = `No geographic relevance to ${proposedState}. Better match: ${keywordAnalysis.topState} (${keywordAnalysis.topMatches.join(', ')})`;
    } else {
      // Proposed state has some keywords but another state has more
      const scoreDifference = keywordAnalysis.topScore - keywordAnalysis.proposedStateScore;
      if (scoreDifference > 3) {
        isRelevant = false;
        confidence = 0.7;
        recommendedState = keywordAnalysis.topState;
        reason = `Stronger geographic relevance to ${keywordAnalysis.topState} than ${proposedState}`;
      } else {
        isRelevant = true;
        confidence = 0.6;
        reason = `Moderate geographic relevance to ${proposedState}`;
      }
    }
  }
  
  // If we have AI analysis, use it to refine the decision
  if (aiAnalysis) {
    if (aiAnalysis.isRegionalEvent) {
      // Regional events should be marked for special handling
      isRelevant = false;
      confidence = aiAnalysis.confidence;
      recommendedState = 'Regional';
      reason = `Regional/multi-state event: ${aiAnalysis.reasoning}`;
    } else if (aiAnalysis.primaryLocation && aiAnalysis.primaryLocation !== 'Unclear' && aiAnalysis.primaryLocation !== proposedState) {
      // AI found a different primary location
      isRelevant = false;
      confidence = aiAnalysis.confidence;
      recommendedState = aiAnalysis.primaryLocation;
      reason = `AI analysis: ${aiAnalysis.reasoning}`;
    } else if (aiAnalysis.isRelevantToProposed) {
      // AI confirms relevance to proposed state
      confidence = Math.max(confidence, aiAnalysis.confidence);
      reason = `Confirmed by AI: ${aiAnalysis.reasoning}`;
    }
  }
  
  return {
    isRelevant,
    confidence,
    recommendedState,
    reason
  };
}

/**
 * Batch analyze multiple articles for geographic relevance
 */
async function batchAnalyzeGeographicRelevance(articles, batchSize = 3) {
  const results = [];
  
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (article, index) => {
      try {
        console.log(`🌍 Analyzing geographic relevance ${i + index + 1}/${articles.length}: "${article.title.substring(0, 50)}..."`);
        const analysis = await analyzeGeographicRelevance(article, article.state);
        
        if (!analysis.isRelevant) {
          console.log(`❌ Geographic mismatch: "${article.title}" assigned to ${article.state} but should be ${analysis.recommendedState}`);
          console.log(`   Reason: ${analysis.reason}`);
        } else {
          console.log(`✅ Geographic match confirmed for ${article.state}`);
        }
        
        return {
          article,
          analysis,
          shouldInclude: analysis.isRelevant && analysis.recommendedState !== 'Regional'
        };
      } catch (error) {
        console.error(`❌ Failed to analyze article ${i + index + 1}:`, error.message);
        return {
          article,
          analysis: { error: error.message },
          shouldInclude: true // Default to including on error
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Add delay between batches
    if (i + batchSize < articles.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

module.exports = {
  analyzeGeographicRelevance,
  batchAnalyzeGeographicRelevance,
  NORTHEAST_STATES
};