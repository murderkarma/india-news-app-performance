const axios = require('axios');
const cheerio = require('cheerio');

async function debugTripuraDetailed() {
    try {
        console.log('🔍 Detailed debugging of Tripura Times...');
        const url = 'https://tripuratimes.com/News/Tripura-News-4.html';
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        
        console.log('📄 Page title:', $('title').text());
        console.log('📄 Page loaded successfully');
        
        // Test current selector
        console.log('\n🧪 Testing current selector: div.nav-item');
        const currentContainers = $('div.nav-item');
        console.log(`Found ${currentContainers.length} containers with current selector`);
        
        if (currentContainers.length > 0) {
            currentContainers.slice(0, 3).each((i, container) => {
                const $container = $(container);
                console.log(`\nContainer ${i + 1}:`);
                console.log('HTML:', $container.html().substring(0, 300) + '...');
                
                const title = $container.find('a').text().trim();
                const link = $container.find('a').attr('href');
                
                console.log('Title:', title);
                console.log('Link:', link);
            });
        }
        
        // Look for actual news content patterns
        console.log('\n🔍 Looking for news content patterns...');
        
        // Check for common news article patterns
        const newsPatterns = [
            'div[class*="news"]',
            'div[class*="article"]',
            'div[class*="post"]',
            'div[class*="story"]',
            'div[class*="item"]',
            'div[class*="content"]',
            'article',
            '.news-item',
            '.article-item',
            '.post-item',
            '.story-item',
            'li[class*="news"]',
            'li[class*="article"]',
            'li[class*="post"]',
            'tr[class*="news"]',
            'tr[class*="article"]'
        ];
        
        for (const pattern of newsPatterns) {
            const elements = $(pattern);
            if (elements.length > 0 && elements.length < 50) { // Avoid too generic selectors
                console.log(`\n✅ Pattern "${pattern}": ${elements.length} elements`);
                
                // Test first few elements
                elements.slice(0, 3).each((i, element) => {
                    const $element = $(element);
                    
                    // Look for title in various ways
                    const title1 = $element.find('h1, h2, h3, h4, h5').first().text().trim();
                    const title2 = $element.find('a').first().text().trim();
                    const title3 = $element.text().trim();
                    
                    // Look for links
                    const link1 = $element.find('a').first().attr('href');
                    const link2 = $element.attr('href');
                    
                    if ((title1 || title2) && (link1 || link2) && (title1?.length > 10 || title2?.length > 10)) {
                        console.log(`  Element ${i + 1}:`);
                        console.log(`    Title (h1-h5): ${title1?.substring(0, 80)}...`);
                        console.log(`    Title (a): ${title2?.substring(0, 80)}...`);
                        console.log(`    Link: ${link1 || link2}`);
                        console.log(`    HTML preview: ${$element.html().substring(0, 150)}...`);
                    }
                });
            }
        }
        
        // Look for table-based news layout (common in older sites)
        console.log('\n🔍 Checking for table-based layout...');
        const tables = $('table');
        console.log(`Found ${tables.length} tables`);
        
        if (tables.length > 0) {
            tables.each((i, table) => {
                const $table = $(table);
                const rows = $table.find('tr');
                console.log(`\nTable ${i + 1}: ${rows.length} rows`);
                
                if (rows.length > 1 && rows.length < 20) { // Reasonable news table
                    rows.slice(0, 3).each((j, row) => {
                        const $row = $(row);
                        const cells = $row.find('td');
                        
                        if (cells.length > 0) {
                            const title = $row.find('a').text().trim();
                            const link = $row.find('a').attr('href');
                            
                            if (title && link && title.length > 10) {
                                console.log(`  Row ${j + 1}: ${title.substring(0, 60)}... -> ${link}`);
                            }
                        }
                    });
                }
            });
        }
        
        // Look for specific content areas
        console.log('\n🔍 Looking for main content areas...');
        const contentAreas = [
            '#main',
            '#content',
            '.main',
            '.content',
            '.news-content',
            '.article-content',
            '.post-content',
            '.main-content',
            '#news',
            '.news',
            '#articles',
            '.articles'
        ];
        
        for (const area of contentAreas) {
            const $area = $(area);
            if ($area.length > 0) {
                console.log(`\n✅ Found content area: ${area}`);
                
                // Look for articles within this area
                const articles = $area.find('div, li, tr, article').filter((i, el) => {
                    const $el = $(el);
                    const hasTitle = $el.find('h1, h2, h3, h4, h5, a').length > 0;
                    const hasLink = $el.find('a').length > 0;
                    const text = $el.text().trim();
                    
                    return hasTitle && hasLink && text.length > 20 && text.length < 500;
                });
                
                console.log(`  Found ${articles.length} potential articles in ${area}`);
                
                if (articles.length > 0 && articles.length < 30) {
                    articles.slice(0, 3).each((i, article) => {
                        const $article = $(article);
                        const title = $article.find('h1, h2, h3, h4, h5, a').first().text().trim();
                        const link = $article.find('a').first().attr('href');
                        
                        if (title && link && title.length > 10) {
                            console.log(`    Article ${i + 1}: ${title.substring(0, 60)}... -> ${link}`);
                        }
                    });
                }
            }
        }
        
        // Check for iframe or dynamic content
        console.log('\n🔍 Checking for dynamic content...');
        const iframes = $('iframe');
        const scripts = $('script');
        console.log(`Found ${iframes.length} iframes and ${scripts.length} scripts`);
        
        if (iframes.length > 0) {
            console.log('⚠️ Site may use iframe-based content loading');
        }
        
        // Look for any links that might be news articles
        console.log('\n🔍 Analyzing all links for news patterns...');
        const allLinks = $('a[href]');
        const newsLinks = [];
        
        allLinks.each((i, link) => {
            const $link = $(link);
            const href = $link.attr('href');
            const text = $link.text().trim();
            
            // Filter for potential news links
            if (href && text && 
                text.length > 15 && text.length < 200 &&
                !href.includes('#') &&
                !href.includes('javascript:') &&
                !text.toLowerCase().includes('home') &&
                !text.toLowerCase().includes('contact') &&
                !text.toLowerCase().includes('about')) {
                
                newsLinks.push({ text, href });
            }
        });
        
        console.log(`Found ${newsLinks.length} potential news links`);
        
        if (newsLinks.length > 0) {
            console.log('\nTop potential news links:');
            newsLinks.slice(0, 5).forEach((link, i) => {
                console.log(`  ${i + 1}. ${link.text.substring(0, 80)}... -> ${link.href}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error debugging Tripura Times:', error.message);
    }
}

debugTripuraDetailed();