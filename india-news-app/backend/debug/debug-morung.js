const axios = require('axios');
const cheerio = require('cheerio');

async function debugMorungExpress() {
    try {
        console.log('🔍 Debugging The Morung Express...');
        const url = 'https://morungexpress.com/category/nagaland';
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        
        console.log('\n📄 Page title:', $('title').text());
        console.log('📄 Page loaded successfully');
        
        // Test current selector
        console.log('\n🧪 Testing current selector: div.post-block');
        const currentContainers = $('div.post-block');
        console.log(`Found ${currentContainers.length} containers with current selector`);
        
        if (currentContainers.length > 0) {
            currentContainers.slice(0, 3).each((i, container) => {
                const $container = $(container);
                console.log(`\nContainer ${i + 1}:`);
                console.log('HTML:', $container.html().substring(0, 200) + '...');
                
                // Test title selectors
                const title1 = $container.find('h2 a').text().trim();
                const title2 = $container.find('h3 a').text().trim();
                const title3 = $container.find('a').first().text().trim();
                
                console.log('Title (h2 a):', title1);
                console.log('Title (h3 a):', title2);
                console.log('Title (a first):', title3);
                
                // Test link selectors
                const link1 = $container.find('h2 a').attr('href');
                const link2 = $container.find('h3 a').attr('href');
                const link3 = $container.find('a').first().attr('href');
                
                console.log('Link (h2 a):', link1);
                console.log('Link (h3 a):', link2);
                console.log('Link (a first):', link3);
            });
        }
        
        // Try alternative selectors
        console.log('\n🔍 Testing alternative selectors...');
        
        const alternatives = [
            'article',
            '.post',
            '.entry',
            '.news-item',
            '.post-item',
            '.content-item',
            'div[class*="post"]',
            'div[class*="article"]',
            'div[class*="news"]'
        ];
        
        for (const selector of alternatives) {
            const containers = $(selector);
            if (containers.length > 0) {
                console.log(`\n✅ Found ${containers.length} containers with: ${selector}`);
                
                // Test first container
                const $first = containers.first();
                const title = $first.find('h2 a, h3 a, h4 a, h5 a, a').first().text().trim();
                const link = $first.find('h2 a, h3 a, h4 a, h5 a, a').first().attr('href');
                
                if (title && link) {
                    console.log(`Sample title: ${title.substring(0, 100)}...`);
                    console.log(`Sample link: ${link}`);
                }
            }
        }
        
        // Check for specific patterns
        console.log('\n🔍 Checking for specific patterns...');
        console.log('Total links on page:', $('a').length);
        console.log('Links with href containing "nagaland":', $('a[href*="nagaland"]').length);
        console.log('Links with href containing "morungexpress":', $('a[href*="morungexpress"]').length);
        
        // Look for main content area
        const mainContent = $('.main-content, #main, .content, .posts, .articles');
        if (mainContent.length > 0) {
            console.log(`\n📰 Found main content area: ${mainContent.length} elements`);
            const articles = mainContent.find('article, .post, div[class*="post"]');
            console.log(`Articles in main content: ${articles.length}`);
        }
        
    } catch (error) {
        console.error('❌ Error debugging The Morung Express:', error.message);
    }
}

debugMorungExpress();