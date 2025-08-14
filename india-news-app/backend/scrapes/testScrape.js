const scrapeEastMojoAssam = require('./eastmojoAssam');

(async () => {
  const articles = await scrapeEastMojoAssam();
  console.log(`✅ Scraped ${articles.length} articles:`);

  articles.forEach((article, index) => {
    console.log(`\n📰 Article ${index + 1}`);
    console.log('Title:', article.title);
    console.log('Link:', article.link);
    console.log('Image:', article.image);
  });
})();