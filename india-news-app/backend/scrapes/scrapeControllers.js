const axios = require('axios');
const cheerio = require('cheerio');
const Article = require('../articleModel.js');
const { enhanceArticleWithAI } = require('../articleControllers.js');

const dynamicScrapeHandler = async (req, res) => {
  const { state } = req.params;
  console.log('Scraper called with state:', state);

  const urlMap = {
    assam: 'https://www.eastmojo.com/tag/assam/',
    manipur: 'https://www.eastmojo.com/tag/manipur/',
    meghalaya: 'https://www.eastmojo.com/tag/meghalaya/',
    arunachal: 'https://www.eastmojo.com/tag/arunachal-pradesh/',
    mizoram: 'https://www.eastmojo.com/tag/mizoram/',
    nagaland: 'https://www.eastmojo.com/tag/nagaland/',
    sikkim: 'https://www.eastmojo.com/tag/sikkim/',
    tripura: 'https://www.eastmojo.com/tag/tripura/',
    // add more states and URLs as needed
  };

  const url = urlMap[state.toLowerCase()];
  if (!url) return res.status(404).json({ error: 'No URL mapped for that state' });

  const newArticles = await scrapeEastMojo(state, url);
  const capitalizedState = state.charAt(0).toUpperCase() + state.slice(1);
  const totalArticles = await Article.countDocuments({ state: capitalizedState });

  res.json({
    inserted: newArticles.length,
    insertedLinks: newArticles.map(a => a.link),
    totalAfterInsert: totalArticles,
  });
};

async function scrapeEastMojo(state, url) {
  console.log('Scraping URL:', url);
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const articles = [];

    $('article').each((i, el) => {
      const link = $(el).find('figure.post-thumbnail a').attr('href');
      
      // Enhanced image extraction with multiple fallbacks
      let image = $(el).find('figure.post-thumbnail img').attr('src') ||
                  $(el).find('figure.post-thumbnail img').attr('data-src') ||
                  $(el).find('img').first().attr('src') ||
                  $(el).find('img').first().attr('data-src') ||
                  $(el).find('.wp-post-image').attr('src') ||
                  $(el).find('.attachment-post-thumbnail').attr('src');
      
      // Ensure image URL is absolute and valid
      if (image) {
        if (!image.startsWith('http')) {
          image = image.startsWith('//') ? `https:${image}` : `https://www.eastmojo.com${image}`;
        }
        // Skip placeholder/invalid images
        if (image.includes('data:image') || image.includes('placeholder') || image.length < 10) {
          image = null;
        }
      }
      
      const title = $(el).find('.entry-title a').text().trim();

      if (title && link) {
        articles.push({
          title,
          link,
          image,
          summary: '',
          state: state.charAt(0).toUpperCase() + state.slice(1),
        });
      }
    });

    let newArticles = [];

    // Save to MongoDB with bulk insert and logging
    try {
      const existingLinks = new Set(
        (await Article.find({ link: { $in: articles.map(a => a.link) } }, { link: 1 })).map(a => a.link)
      );

      newArticles = articles.filter(article => !existingLinks.has(article.link));

      if (newArticles.length > 0) {
        const insertedArticles = await Article.insertMany(newArticles);
        const check = await Article.find({ state: state.charAt(0).toUpperCase() + state.slice(1) });
        console.log(`🧠 Articles in DB after insert for ${state}:`, check.length);
        console.log(`✅ Inserted ${newArticles.length} new article(s).`);
        
        // Automatically enhance new articles with AI in the background
        console.log(`🤖 Starting AI enhancement for ${insertedArticles.length} new articles...`);
        insertedArticles.forEach(article => {
          enhanceArticleWithAI(article).catch(err => {
            console.error(`🤖 Background AI enhancement failed for article ${article._id}:`, err.message);
          });
        });
      } else {
        console.log('🔁 All articles already exist.');
      }
    } catch (err) {
      console.error('❌ Error during bulk insert:', err);
    }

    return newArticles;
  } catch (err) {
    console.error(`Error scraping EastMojo for ${state}:`, err);
    return [];
  }
}

module.exports = {
  dynamicScrapeHandler
};