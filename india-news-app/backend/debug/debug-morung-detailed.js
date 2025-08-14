const axios = require('axios');
const cheerio = require('cheerio');

async function debugMorungDetailed() {
    try {
        console.log('🔍 Detailed debugging of The Morung Express...');
        const url = 'https://morungexpress.com/category/nagaland';
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        
        // Look for the complete article structure
        console.log('\n🔍 Looking for complete article structure...');
        
        // Check if there are post-title elements
        const postTitles = $('.post-title');
        console.log(`Found ${postTitles.length} .post-title elements`);
        
        if (postTitles.length > 0) {
            postTitles.slice(0, 3).each((i, title) => {
                const $title = $(title);
                console.log(`\nPost Title ${i + 1}:`);
                console.log('Text:', $title.text().trim());
                console.log('HTML:', $title.html());
                
                const link = $title.find('a').attr('href') || $title.closest('a').attr('href');
                console.log('Link:', link);
            });
        }
        
        // Look for article containers that might contain both image and title
        console.log('\n🔍 Looking for parent containers...');
        
        const postBlocks = $('.post-block');
        console.log(`Found ${postBlocks.length} .post-block elements`);
        
        if (postBlocks.length > 0) {
            postBlocks.slice(0, 3).each((i, block) => {
                const $block = $(block);
                const $parent = $block.parent();
                
                console.log(`\nPost Block ${i + 1} Parent:`);
                console.log('Parent tag:', $parent.prop('tagName'));
                console.log('Parent class:', $parent.attr('class'));
                
                // Look for title in parent or siblings
                const titleInParent = $parent.find('.post-title, h2, h3, h4').first().text().trim();
                const titleInSibling = $block.siblings().find('.post-title, h2, h3, h4').first().text().trim();
                
                console.log('Title in parent:', titleInParent);
                console.log('Title in sibling:', titleInSibling);
                
                // Check if parent has both image and title
                const hasImage = $parent.find('img').length > 0;
                const hasTitle = $parent.find('.post-title, h2, h3, h4').length > 0;
                console.log('Parent has image:', hasImage);
                console.log('Parent has title:', hasTitle);
            });
        }
        
        // Try to find the actual article structure
        console.log('\n🔍 Looking for article structure patterns...');
        
        const patterns = [
            '.post-item',
            '.article-item',
            '.news-item',
            '.entry',
            'article',
            '.post',
            '[class*="post-"]',
            '[class*="article-"]'
        ];
        
        for (const pattern of patterns) {
            const elements = $(pattern);
            if (elements.length > 0) {
                console.log(`\n✅ Pattern "${pattern}": ${elements.length} elements`);
                
                const $first = elements.first();
                const title = $first.find('.post-title, h2, h3, h4, h5').first().text().trim();
                const link = $first.find('a').first().attr('href');
                const image = $first.find('img').first().attr('src');
                
                if (title || link) {
                    console.log('Sample title:', title.substring(0, 100));
                    console.log('Sample link:', link);
                    console.log('Sample image:', image);
                }
            }
        }
        
        // Look for the main content structure
        console.log('\n🔍 Analyzing main content structure...');
        const mainContent = $('.main-content, #main, .content, .posts, .blog-posts, .category-posts');
        
        if (mainContent.length > 0) {
            console.log(`Found main content: ${mainContent.length} elements`);
            
            mainContent.each((i, content) => {
                const $content = $(content);
                console.log(`\nMain Content ${i + 1}:`);
                console.log('Tag:', $content.prop('tagName'));
                console.log('Class:', $content.attr('class'));
                
                // Look for direct children that might be articles
                const children = $content.children();
                console.log('Direct children:', children.length);
                
                children.slice(0, 3).each((j, child) => {
                    const $child = $(child);
                    console.log(`Child ${j + 1}: ${$child.prop('tagName')}.${$child.attr('class')}`);
                    
                    const hasTitle = $child.find('.post-title, h2, h3, h4').length > 0;
                    const hasImage = $child.find('img').length > 0;
                    const hasLink = $child.find('a').length > 0;
                    
                    console.log(`  Has title: ${hasTitle}, image: ${hasImage}, link: ${hasLink}`);
                });
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugMorungDetailed();