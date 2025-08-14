const mongoose = require('mongoose');
const Article = require('../articleModel.js');

/**
 * Fix broken fallback image URLs in the database
 * Run this script to remove broken logo URLs from articles
 */
async function fixBrokenImages() {
  try {
    console.log('🔧 Starting broken image cleanup...');
    
    // Connect to MongoDB using environment variable
    require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Define broken image URL patterns
    const brokenImagePatterns = [
      'nagalandpost.com.*logo.png',
      'easternmirrornagaland.com.*logo.png',
      'nenow.in.*logo.png',
      'assamtribune.com.*logo.png',
      'sentinelassam.com.*logo.png',
      'northeasttoday.in.*logo.png',
      'thefrontiermanipur.com.*logo.png',
      'theshillongtimes.com.*logo.png',
      'meghalayamonitor.com.*logo.png',
      'morungexpress.com.*logo.png',
      'arunachaltimes.in.*logo.png',
      'arunachal24.in.*logo.png',
      'tripuratimes.com.*logo.png',
      'data:image/gif;base64',
      'R0lGODlhAQABAAD' // 1x1 transparent GIF placeholder
    ];

    // Create regex pattern
    const regexPattern = brokenImagePatterns.join('|');
    
    // Count articles with broken images
    const brokenCount = await Article.countDocuments({
      image: { $regex: regexPattern, $options: 'i' }
    });
    
    console.log(`🚨 Found ${brokenCount} articles with broken fallback images`);

    if (brokenCount === 0) {
      console.log('✅ No broken images found - database is clean!');
      process.exit(0);
    }

    // Show examples
    const samples = await Article.find({
      image: { $regex: regexPattern, $options: 'i' }
    }).limit(3);
    
    console.log('\n📋 Sample broken images:');
    samples.forEach((article, index) => {
      console.log(`${index + 1}. ${article.title.substring(0, 50)}...`);
      console.log(`   Image: ${article.image}`);
      console.log(`   State: ${article.state}`);
    });

    // Fix the broken images by setting them to null
    const updateResult = await Article.updateMany(
      { image: { $regex: regexPattern, $options: 'i' } },
      { 
        $set: { 
          image: null,
          imageFixed: true,
          imageFixedAt: new Date()
        }
      }
    );

    console.log(`✅ Updated ${updateResult.modifiedCount} articles`);
    console.log('🎯 Broken fallback images have been removed');
    console.log('📱 Articles will now display without images instead of 404 errors');

    // Verify the fix
    const remainingBroken = await Article.countDocuments({
      image: { $regex: regexPattern, $options: 'i' }
    });
    
    console.log(`🔍 Remaining broken images: ${remainingBroken}`);

    if (remainingBroken === 0) {
      console.log('🎉 All broken images have been successfully cleaned up!');
    }

    await mongoose.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing broken images:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  fixBrokenImages();
}

module.exports = { fixBrokenImages };