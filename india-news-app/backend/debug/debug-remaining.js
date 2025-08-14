const axios = require('axios');
const cheerio = require('cheerio');

const failingSources = [
  {
    name: 'Meghalaya Monitor',
    url: 'https://meghalayamonitor.com/category/state/',
    currentSelector: 'div.td_module_flex'
  },
  {
    name: 'Nagaland Post',
    url: 'https://nagalandpost.com/category/nagaland-news/',
    currentSelector: 'div.td_module_loop'
  },
  {
    name: 'Eastern Mirror (Nagaland)',
    url: 'https://www.easternmirrornagaland.com/nagaland',
    currentSelector: 'div.flex.flex-wrap.gap-3.grid'
  },
  {
    name: 'The Morung Express',
    url: 'https://morungexpress.com/category/nagaland',
    currentSelector: 'ul.item_list li.view-list-item'
  },
  {
    name: 'Tripura Times',
    url: 'https://tripuratimes.com/News/Tripura-News-4.html',
    currentSelector: 'div.col-lg-6'
  }
];

async function debugSource(source) {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`🔍 Debugging ${source.name}`);
    console.log(`📍 URL: ${source.url}`);
    console.log(`🎯 Current selector: ${source.currentSelector}`);
    
    const response = await axios.get(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Test current selector
    const currentElements = $(source.currentSelector);
    console.log(`📦 Current selector finds: ${currentElements.length} elements`);
    
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
      'li[class*="item"]',
      '.td_module_1',
      '.td_module_2',
      '.td_module_3',
      '.td_module_4',
      '.td_module_5',
      '.td_module_6',
      '.td_module_7',
      '.td_module_8',
      '.td_module_9',
      '.td_module_10'
    ];

    console.log('\n📊 Testing potential article containers:');
    
    for (const selector of possibleSelectors) {
      const elements = $(selector);
      if (elements.length > 0 && elements.length < 50) {
        console.log(`✅ ${selector}: ${elements.length} elements`);
        
        // Check first element for title links
        const firstElement = elements.first();
        const titleLinks = firstElement.find('a').filter((i, el) => {
          const text = $(el).text().trim();
          return text.length > 10 && text.length < 200;
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
              cls.includes('card') || cls.includes('story') || cls.includes('news') ||
              cls.includes('td_module')) {
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
    console.error(`❌ Error debugging ${source.name}:`, error.message);
  }
}

async function main() {
  for (const source of failingSources) {
    await debugSource(source);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Delay between requests
  }
}

main().catch(console.error);