const axios = require('axios');
const cheerio = require('cheerio');

async function debugFrontier() {
  try {
    console.log('🔍 Debugging The Frontier Manipur...');
    
    const response = await axios.get('https://thefrontiermanipur.com/category/manipur/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Test the container selector
    const containers = $('div.listing-item');
    console.log(`📦 Found ${containers.length} containers with div.listing-item`);
    
    if (containers.length > 0) {
      console.log('\n🔍 Analyzing first container:');
      const firstContainer = containers.first();
      
      console.log('📋 First container HTML:');
      console.log(firstContainer.html().substring(0, 800));
      
      // Look for all links
      const allLinks = firstContainer.find('a');
      console.log(`\n🔗 Found ${allLinks.length} links in container`);
      
      allLinks.each((i, link) => {
        const $link = $(link);
        const text = $link.text().trim();
        const href = $link.attr('href');
        if (text.length > 5) {
          console.log(`   Link ${i + 1}: "${text.substring(0, 60)}..." -> ${href}`);
        }
      });
      
      // Look for post-title specifically
      const postTitles = firstContainer.find('.post-title');
      console.log(`\n📰 Found ${postTitles.length} .post-title elements`);
      
      postTitles.each((i, title) => {
        const $title = $(title);
        console.log(`   Title ${i + 1}: "${$title.text().trim()}"`);
        const link = $title.find('a');
        if (link.length > 0) {
          console.log(`     -> Link: ${link.attr('href')}`);
        }
      });
    }

    // Also try alternative selectors
    console.log('\n🎯 Testing alternative selectors:');
    const alternatives = [
      'article',
      '.type-post',
      '.has-post-thumbnail',
      '.post-url',
      '.item-inner'
    ];
    
    for (const selector of alternatives) {
      const elements = $(selector);
      if (elements.length > 0 && elements.length < 50) {
        console.log(`✅ ${selector}: ${elements.length} elements`);
        
        const firstEl = elements.first();
        const titleLinks = firstEl.find('a').filter((i, el) => {
          const text = $(el).text().trim();
          return text.length > 10 && text.length < 200;
        });
        
        if (titleLinks.length > 0) {
          console.log(`   📰 Sample title: "${titleLinks.first().text().trim().substring(0, 60)}..."`);
          console.log(`   🔗 Sample link: ${titleLinks.first().attr('href')}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugFrontier();