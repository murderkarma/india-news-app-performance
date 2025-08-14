const axios = require('axios');
const cheerio = require('cheerio');

async function debugRemainingIssues() {
    console.log('🔍 Debugging remaining problematic sources...\n');
    
    // Debug Eastern Mirror
    try {
        console.log('=== EASTERN MIRROR DEBUG ===');
        const url1 = 'https://www.easternmirrornagaland.com/nagaland';
        
        const response1 = await axios.get(url1, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        
        const $1 = cheerio.load(response1.data);
        
        console.log('📄 Page title:', $1('title').text());
        
        // Test current selector
        const currentContainers1 = $1('div.grid');
        console.log(`Current selector 'div.grid': ${currentContainers1.length} containers`);
        
        // Try better selectors
        const alternatives1 = [
            'article',
            '.post',
            '.news-item',
            '.entry',
            'div[class*="post"]',
            'div[class*="article"]',
            'div[class*="news"]',
            '.content-item',
            '.story'
        ];
        
        for (const selector of alternatives1) {
            const containers = $1(selector);
            if (containers.length > 0) {
                console.log(`✅ Found ${containers.length} containers with: ${selector}`);
                
                const $first = containers.first();
                const title = $first.find('h1, h2, h3, h4, h5, a').first().text().trim();
                const link = $first.find('a').first().attr('href');
                
                if (title && link) {
                    console.log(`Sample title: ${title.substring(0, 80)}...`);
                    console.log(`Sample link: ${link}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Eastern Mirror error:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Debug Tripura Times
    try {
        console.log('=== TRIPURA TIMES DEBUG ===');
        const url2 = 'https://tripuratimes.com/News/Tripura-News-4.html';
        
        const response2 = await axios.get(url2, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        
        const $2 = cheerio.load(response2.data);
        
        console.log('📄 Page title:', $2('title').text());
        
        // Test current selector
        const currentContainers2 = $2('div.nav-item');
        console.log(`Current selector 'div.nav-item': ${currentContainers2.length} containers`);
        
        if (currentContainers2.length > 0) {
            currentContainers2.slice(0, 3).each((i, container) => {
                const $container = $2(container);
                console.log(`\nContainer ${i + 1}:`);
                console.log('HTML:', $container.html().substring(0, 200) + '...');
                
                const title = $container.find('a').text().trim();
                const link = $container.find('a').attr('href');
                
                console.log('Title:', title);
                console.log('Link:', link);
            });
        }
        
        // Try better selectors
        const alternatives2 = [
            'article',
            '.post',
            '.news-item',
            '.entry',
            'div[class*="post"]',
            'div[class*="article"]',
            'div[class*="news"]',
            '.content-item',
            '.story',
            'li',
            'tr'
        ];
        
        for (const selector of alternatives2) {
            const containers = $2(selector);
            if (containers.length > 0 && containers.length < 100) { // Avoid too generic selectors
                console.log(`✅ Found ${containers.length} containers with: ${selector}`);
                
                const $first = containers.first();
                const title = $first.find('h1, h2, h3, h4, h5, a').first().text().trim();
                const link = $first.find('a').first().attr('href');
                
                if (title && link && title.length > 10) {
                    console.log(`Sample title: ${title.substring(0, 80)}...`);
                    console.log(`Sample link: ${link}`);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Tripura Times error:', error.message);
    }
}

debugRemainingIssues();