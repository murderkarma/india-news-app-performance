const axios = require('axios');
const cheerio = require('cheerio');

async function debugSelectors(url, siteName) {
  try {
    console.log(`🔍 Debugging ${siteName}: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Look for common article containers
    const possibleSelectors = [
      'article',
      'div[class*="post"]',
      'div[class*="article"]',
      'div[class*="item"]',
      'div[class*="card"]',
      'div[class*="story"]',
      'div[class*="news"]',
      'div[class*="content"]',
      'div[class*="grid"]',
      'div[class*="col"]',
      'li[class*="post"]',
      'li[class*="item"]'
    ];

    console.log('\n📊 Testing potential article containers:');
    
    for (const selector of possibleSelectors) {
      const elements = $(selector);
      if (elements.length > 0 && elements.length < 50) { // Reasonable number of articles
        console.log(`✅ ${selector}: ${elements.length} elements`);
        
        // Check first element for title links
        const firstElement = elements.first();
        const titleLinks = firstElement.find('a').filter((i, el) => {
          const text = $(el).text().trim();
          return text.length > 10 && text.length < 200; // Reasonable title length
        });
        
        if (titleLinks.length > 0) {
          console.log(`   📰 Found ${titleLinks.length} potential title links`);
          console.log(`   📝 Sample title: "${titleLinks.first().text().trim().substring(0, 60)}..."`);
          console.log(`   🔗 Sample link: ${titleLinks.first().attr('href')}`);
        }
      }
    }

    // Look for specific patterns in class names
    console.log('\n🎯 Analyzing class patterns:');
    const allElements = $('*[class]');
    const classPatterns = {};
    
    allElements.each((i, el) => {
      const className = $(el).attr('class');
      if (className) {
        const classes = className.split(' ');
        classes.forEach(cls => {
          if (cls.includes('post') || cls.includes('article') || cls.includes('item') || 
              cls.includes('card') || cls.includes('story') || cls.includes('news')) {
            classPatterns[cls] = (classPatterns[cls] || 0) + 1;
          }
        });
      }
    });

    const sortedPatterns = Object.entries(classPatterns)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);

    sortedPatterns.forEach(([pattern, count]) => {
      if (count > 1 && count < 50) {
        console.log(`   🏷️  .${pattern}: ${count} elements`);
      }
    });

  } catch (error) {
    console.error(`❌ Error debugging ${siteName}:`, error.message);
  }
}

// Test the failing sources
async function main() {
  const failingSources = [
    { name: 'Northeast Today', url: 'https://northeasttoday.in/tag/assam/' },
    { name: 'Sentinel Assam', url: 'https://www.sentinelassam.com/north-east-india-news/assam-news' },
    { name: 'The Frontier Manipur', url: 'https://thefrontiermanipur.com/category/manipur/' }
  ];

  for (const source of failingSources) {
    await debugSelectors(source.url, source.name);
    console.log('\n' + '='.repeat(80) + '\n');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between requests
  }
}

main().catch(console.error);