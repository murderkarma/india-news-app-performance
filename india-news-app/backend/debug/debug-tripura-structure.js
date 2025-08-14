const axios = require('axios');
const cheerio = require('cheerio');

async function debugTripuraStructure() {
    try {
        console.log('🔍 Finding Tripura Times article structure...');
        const url = 'https://tripuratimes.com/News/Tripura-News-4.html';
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 15000
        });
        
        const $ = cheerio.load(response.data);
        
        // Focus on the specific news links we found
        const newsLinks = [
            '/ttimes/tripura-gramin-bank-opens-2-new-branches-in-khowai-district-28916.html',
            '/ttimes/twelve-hms-promoted-in-tripura-28915.html',
            '/ttimes/congress-to-fight-ttaadc-elections-with-full-strength-28913.html',
            '/ttimes/1200-queen-pineapples-from-tripura-exported-to-delhi-28912.html'
        ];
        
        console.log('\n🔍 Finding containers for actual news links...');
        
        for (const linkHref of newsLinks) {
            const $link = $(`a[href="${linkHref}"]`);
            if ($link.length > 0) {
                console.log(`\n📰 Found link: ${$link.text().trim()}`);
                console.log(`Link href: ${linkHref}`);
                
                // Find the parent containers
                let $current = $link;
                let level = 0;
                
                while ($current.length > 0 && level < 5) {
                    $current = $current.parent();
                    level++;
                    
                    const tagName = $current.prop('tagName');
                    const className = $current.attr('class') || '';
                    const id = $current.attr('id') || '';
                    
                    console.log(`  Level ${level}: ${tagName}${id ? '#' + id : ''}${className ? '.' + className.replace(/\s+/g, '.') : ''}`);
                    
                    // Check if this container has multiple news links
                    const linksInContainer = $current.find('a[href*="/ttimes/"]').length;
                    if (linksInContainer > 1) {
                        console.log(`    ✅ This container has ${linksInContainer} news links!`);
                        
                        // Show all news links in this container
                        $current.find('a[href*="/ttimes/"]').slice(0, 5).each((i, link) => {
                            const $newsLink = $(link);
                            console.log(`      ${i + 1}. ${$newsLink.text().trim().substring(0, 60)}...`);
                        });
                        
                        // This might be our target container
                        console.log(`    🎯 Potential container selector: ${tagName}${className ? '.' + className.replace(/\s+/g, '.') : ''}`);
                        break;
                    }
                }
                
                break; // Just analyze the first link for structure
            }
        }
        
        // Also look for any container that has multiple /ttimes/ links
        console.log('\n🔍 Looking for containers with multiple /ttimes/ links...');
        
        const allContainers = $('div, section, article, ul, ol, table, tbody');
        
        allContainers.each((i, container) => {
            const $container = $(container);
            const newsLinksCount = $container.find('a[href*="/ttimes/"]').length;
            
            if (newsLinksCount >= 3) { // At least 3 news links
                const tagName = $container.prop('tagName');
                const className = $container.attr('class') || '';
                const id = $container.attr('id') || '';
                
                console.log(`\n✅ Container with ${newsLinksCount} news links:`);
                console.log(`   Selector: ${tagName}${id ? '#' + id : ''}${className ? '.' + className.replace(/\s+/g, '.') : ''}`);
                
                // Show sample links
                $container.find('a[href*="/ttimes/"]').slice(0, 3).each((j, link) => {
                    const $link = $(link);
                    console.log(`   ${j + 1}. ${$link.text().trim().substring(0, 60)}...`);
                });
                
                // Check if links are in direct children or nested
                const directChildren = $container.children();
                let childrenWithLinks = 0;
                
                directChildren.each((k, child) => {
                    const $child = $(child);
                    if ($child.find('a[href*="/ttimes/"]').length > 0) {
                        childrenWithLinks++;
                    }
                });
                
                if (childrenWithLinks > 0) {
                    console.log(`   📦 ${childrenWithLinks} direct children contain news links`);
                    
                    // Show the structure of children
                    directChildren.slice(0, 3).each((k, child) => {
                        const $child = $(child);
                        const childTag = $child.prop('tagName');
                        const childClass = $child.attr('class') || '';
                        const hasNewsLink = $child.find('a[href*="/ttimes/"]').length > 0;
                        
                        if (hasNewsLink) {
                            console.log(`     Child ${k + 1}: ${childTag}${childClass ? '.' + childClass.replace(/\s+/g, '.') : ''}`);
                            const linkText = $child.find('a[href*="/ttimes/"]').first().text().trim();
                            console.log(`       Link: ${linkText.substring(0, 50)}...`);
                        }
                    });
                }
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugTripuraStructure();