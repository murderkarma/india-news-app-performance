const axios = require('axios');
const cheerio = require('cheerio');
const Article = require('../articleModel.js');

async function scrapeEastMojo(state, url) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const articles = [];

    $('article').each((i, el) => {
      const link = $(el).find('figure.post-thumbnail a').attr('href');
      const image = $(el).find('figure.post-thumbnail img').attr('src') ||
                    $(el).find('figure.post-thumbnail img').attr('data-src');
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

    // Save to MongoDB
    let newInserts = 0;

    for (const article of articles) {
      const res = await Article.findOneAndUpdate(
        { link: article.link },
        article,
        { upsert: true, new: false, rawResult: true }
      );

      if (!res.lastErrorObject.updatedExisting) {
        newInserts++;
      }
    }

    return { total: articles.length, inserted: newInserts, articles };
  } catch (err) {
    console.error(`Error scraping EastMojo for ${state}:`, err.message);
    return [];
  }
}

module.exports = scrapeEastMojo;
