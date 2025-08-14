const axios = require('axios');
const cheerio = require('cheerio');

async function debugSentinel() {
  try {
    console.log('🔍 Debugging Sentinel Assam selectors...');
    
    const response = await axios.get('https://www.sentinelassam.com/north-east-india-news/assam-news', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    
    // Test the container selector
    const containers = $('div.four-col-m_story-card-wrapper__1e8p0');
    console.log(`📦 Found ${containers.length} containers`);
    
    if (containers.length > 0) {
      console.log('\n🔍 Analyzing first container:');
      const firstContainer = containers.first();
      
      // Look for all links in the container
      const allLinks = firstContainer.find('a');
      console.log(`🔗 Found ${allLinks.length} links in container`);
      
      allLinks.each((i, link) => {
        const $link = $(link);
        const text = $link.text().trim();
        const href = $link.attr('href');
        if (text.length > 10) {
          console.log(`   Link ${i + 1}: "${text.substring(0, 60)}..." -> ${href}`);
        }
      });
      
      // Look for all headings
      const headings = firstContainer.find('h1, h2, h3, h4, h5, h6');
      console.log(`\n📰 Found ${headings.length} headings in container`);
      
      headings.each((i, heading) => {
        const $heading = $(heading);
        const tagName = heading.tagName;
        const text = $heading.text().trim();
        const classes = $heading.attr('class') || '';
        console.log(`   ${tagName}.${classes}: "${text.substring(0, 60)}..."`);
        
        // Check for links inside headings
        const linkInHeading = $heading.find('a');
        if (linkInHeading.length > 0) {
          console.log(`     -> Contains link: ${linkInHeading.attr('href')}`);
        }
      });
      
      // Look for elements with specific classes
      console.log('\n🎯 Looking for elements with "headline" in class:');
      firstContainer.find('*[class*="headline"]').each((i, el) => {
        const $el = $(el);
        const tagName = el.tagName;
        const classes = $el.attr('class');
        const text = $el.text().trim();
        console.log(`   ${tagName}.${classes}: "${text.substring(0, 60)}..."`);
      });
      
      // Print the HTML structure of the first container
      console.log('\n📋 First container HTML structure:');
      console.log(firstContainer.html().substring(0, 500) + '...');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugSentinel();