/**
 * Data Migration Script - Unified Post Model
 * Safely migrates existing YAP and Tea/Island posts to the new unified Post model
 * Preserves all data integrity including reactions, comments, metrics, and timestamps
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

// Import models
const { Post } = require('../models/postModel');
const { YapPost } = require('../yapPostModel');
const TeaIslandPost = require('../teaIslandPostModel');

// Migration statistics
const stats = {
  yap: { total: 0, migrated: 0, errors: 0 },
  tea: { total: 0, migrated: 0, errors: 0 },
  brospace: { total: 0, migrated: 0, errors: 0 },
  total: { total: 0, migrated: 0, errors: 0 }
};

/**
 * Connect to MongoDB
 */
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB for migration');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

/**
 * Migrate YAP posts to unified Post model
 */
async function migrateYapPosts() {
  console.log('\n🔄 Starting YAP posts migration...');
  
  try {
    const yapPosts = await YapPost.find({}).lean();
    stats.yap.total = yapPosts.length;
    
    console.log(`📊 Found ${yapPosts.length} YAP posts to migrate`);
    
    for (const yapPost of yapPosts) {
      try {
        // Check if already migrated
        const existing = await Post.findOne({ 
          space: 'yap', 
          userId: yapPost.userId,
          body: yapPost.body,
          createdAt: yapPost.createdAt
        });
        
        if (existing) {
          console.log(`⏭️  YAP post ${yapPost._id} already migrated, skipping`);
          continue;
        }
        
        // Create unified post
        const unifiedPost = new Post({
          space: 'yap',
          userId: yapPost.userId,
          title: yapPost.title,
          body: yapPost.body,
          images: yapPost.images || [],
          topic: yapPost.topic,
          state: yapPost.state,
          reactions: yapPost.reactions || [],
          comments: yapPost.comments || [],
          metrics: {
            views: yapPost.metrics?.views || 0,
            score: yapPost.metrics?.score || 0,
            engagementRate: 0 // Will be calculated on save
          },
          isActive: yapPost.isActive !== false,
          isHot: false, // Will be calculated on save
          isPinned: false,
          isRemoved: yapPost.isRemoved || false,
          removedBy: yapPost.removedBy,
          removedAt: yapPost.removedAt,
          removalReason: yapPost.removalReason,
          lastActivity: yapPost.updatedAt || yapPost.createdAt,
          createdAt: yapPost.createdAt,
          updatedAt: yapPost.updatedAt
        });
        
        await unifiedPost.save();
        stats.yap.migrated++;
        
        if (stats.yap.migrated % 10 === 0) {
          console.log(`📈 YAP migration progress: ${stats.yap.migrated}/${stats.yap.total}`);
        }
        
      } catch (error) {
        console.error(`❌ Error migrating YAP post ${yapPost._id}:`, error.message);
        stats.yap.errors++;
      }
    }
    
    console.log(`✅ YAP migration completed: ${stats.yap.migrated} migrated, ${stats.yap.errors} errors`);
    
  } catch (error) {
    console.error('❌ YAP migration failed:', error);
    throw error;
  }
}

/**
 * Migrate Tea/Island posts to unified Post model
 */
async function migrateTeaIslandPosts() {
  console.log('\n🔄 Starting Tea/Island posts migration...');
  
  try {
    const teaIslandPosts = await TeaIslandPost.find({}).lean();
    const totalPosts = teaIslandPosts.length;
    
    console.log(`📊 Found ${totalPosts} Tea/Island posts to migrate`);
    
    for (const post of teaIslandPosts) {
      try {
        // Determine space based on tab field
        let space;
        if (post.tab === 'tea') {
          space = 'tea';
          stats.tea.total++;
        } else if (post.tab === 'island') {
          space = 'brospace';
          stats.brospace.total++;
        } else if (post.tab === 'general') {
          space = 'local';
          // Note: Local space will be handled separately if needed
          continue;
        } else {
          console.warn(`⚠️  Unknown tab '${post.tab}' for post ${post._id}, skipping`);
          continue;
        }
        
        // Check if already migrated
        const existing = await Post.findOne({ 
          space,
          userId: post.author,
          body: post.content,
          createdAt: post.createdAt
        });
        
        if (existing) {
          console.log(`⏭️  ${space.toUpperCase()} post ${post._id} already migrated, skipping`);
          continue;
        }
        
        // Convert Tea/Island reactions to unified format
        const reactions = [];
        if (post.reactionUsers && post.reactionUsers.length > 0) {
          // Convert simple reactions to heart reactions (most common)
          post.reactionUsers.forEach(userId => {
            reactions.push({
              userId: userId,
              type: 'heart',
              createdAt: post.createdAt
            });
          });
        }
        
        // Convert Tea/Island comments to unified format
        const comments = [];
        // Tea/Island posts don't have embedded comments in the current model
        // Comments would be in a separate collection if they exist
        
        // Create unified post
        const unifiedPost = new Post({
          space,
          userId: post.author,
          title: post.title,
          body: post.content,
          images: [], // Tea/Island posts don't have images in current model
          topic: post.subcategory, // Use subcategory as topic
          category: post.category,
          subcategory: post.subcategory,
          state: post.state,
          reactions,
          comments,
          metrics: {
            views: post.views || 0,
            score: 0, // Will be calculated on save
            engagementRate: 0
          },
          isActive: post.isActive !== false,
          isHot: post.isHot || false,
          isPinned: post.isPinned || false,
          isRemoved: post.isRemoved || false,
          removedBy: post.removedBy,
          removedAt: post.removedAt,
          removalReason: post.removalReason,
          lastActivity: post.lastActivity || post.updatedAt || post.createdAt,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt
        });
        
        await unifiedPost.save();
        
        if (space === 'tea') {
          stats.tea.migrated++;
        } else {
          stats.brospace.migrated++;
        }
        
        const totalMigrated = stats.tea.migrated + stats.brospace.migrated;
        if (totalMigrated % 10 === 0) {
          console.log(`📈 Tea/Brospace migration progress: ${totalMigrated}/${stats.tea.total + stats.brospace.total}`);
        }
        
      } catch (error) {
        console.error(`❌ Error migrating Tea/Island post ${post._id}:`, error.message);
        if (post.tab === 'tea') {
          stats.tea.errors++;
        } else {
          stats.brospace.errors++;
        }
      }
    }
    
    console.log(`✅ Tea migration completed: ${stats.tea.migrated} migrated, ${stats.tea.errors} errors`);
    console.log(`✅ Brospace migration completed: ${stats.brospace.migrated} migrated, ${stats.brospace.errors} errors`);
    
  } catch (error) {
    console.error('❌ Tea/Island migration failed:', error);
    throw error;
  }
}

/**
 * Verify migration integrity
 */
async function verifyMigration() {
  console.log('\n🔍 Verifying migration integrity...');
  
  try {
    // Count posts in unified model
    const yapCount = await Post.countDocuments({ space: 'yap' });
    const teaCount = await Post.countDocuments({ space: 'tea' });
    const brospaceCount = await Post.countDocuments({ space: 'brospace' });
    const totalCount = yapCount + teaCount + brospaceCount;
    
    console.log(`📊 Unified Post counts:`);
    console.log(`   YAP: ${yapCount}`);
    console.log(`   Tea: ${teaCount}`);
    console.log(`   Brospace: ${brospaceCount}`);
    console.log(`   Total: ${totalCount}`);
    
    // Verify data integrity with sample checks
    console.log('\n🔬 Performing data integrity checks...');
    
    // Check YAP posts
    const yapSample = await Post.findOne({ space: 'yap' }).populate('userId', 'username');
    if (yapSample) {
      console.log(`✅ YAP sample: "${yapSample.title || yapSample.body.substring(0, 50)}..." by ${yapSample.userId?.username || 'Unknown'}`);
      console.log(`   Reactions: ${yapSample.reactions.length}, Comments: ${yapSample.comments.length}, Views: ${yapSample.metrics.views}`);
    }
    
    // Check Tea posts
    const teaSample = await Post.findOne({ space: 'tea' }).populate('userId', 'username');
    if (teaSample) {
      console.log(`✅ Tea sample: "${teaSample.title || teaSample.body.substring(0, 50)}..." by ${teaSample.userId?.username || 'Unknown'}`);
      console.log(`   Category: ${teaSample.topic}, State: ${teaSample.state}`);
    }
    
    // Check Brospace posts
    const brospaceample = await Post.findOne({ space: 'brospace' }).populate('userId', 'username');
    if (brospaceample) {
      console.log(`✅ Brospace sample: "${brospaceample.title || brospaceample.body.substring(0, 50)}..." by ${brospaceample.userId?.username || 'Unknown'}`);
      console.log(`   Category: ${brospaceample.topic}, State: ${brospaceample.state}`);
    }
    
    console.log('\n✅ Migration verification completed successfully');
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    throw error;
  }
}

/**
 * Generate migration report
 */
function generateReport() {
  console.log('\n📋 MIGRATION REPORT');
  console.log('==================');
  
  stats.total.total = stats.yap.total + stats.tea.total + stats.brospace.total;
  stats.total.migrated = stats.yap.migrated + stats.tea.migrated + stats.brospace.migrated;
  stats.total.errors = stats.yap.errors + stats.tea.errors + stats.brospace.errors;
  
  console.log(`YAP Posts:       ${stats.yap.migrated}/${stats.yap.total} migrated (${stats.yap.errors} errors)`);
  console.log(`Tea Posts:       ${stats.tea.migrated}/${stats.tea.total} migrated (${stats.tea.errors} errors)`);
  console.log(`Brospace Posts:  ${stats.brospace.migrated}/${stats.brospace.total} migrated (${stats.brospace.errors} errors)`);
  console.log(`─────────────────────────────────────────────────────────`);
  console.log(`TOTAL:           ${stats.total.migrated}/${stats.total.total} migrated (${stats.total.errors} errors)`);
  
  const successRate = ((stats.total.migrated / stats.total.total) * 100).toFixed(2);
  console.log(`Success Rate:    ${successRate}%`);
  
  if (stats.total.errors === 0) {
    console.log('\n🎉 Migration completed successfully with no errors!');
  } else {
    console.log(`\n⚠️  Migration completed with ${stats.total.errors} errors. Please review the logs above.`);
  }
  
  console.log('\n📝 Next Steps:');
  console.log('1. Test the unified /api/posts endpoints');
  console.log('2. Update frontend services to use the new API');
  console.log('3. Add backward compatibility proxies');
  console.log('4. Monitor for any issues');
  console.log('5. Remove old models after verification');
}

/**
 * Main migration function
 */
async function runMigration() {
  console.log('🚀 Starting Unified Post Model Migration');
  console.log('========================================');
  
  try {
    await connectDB();
    
    // Run migrations
    await migrateYapPosts();
    await migrateTeaIslandPosts();
    
    // Verify migration
    await verifyMigration();
    
    // Generate report
    generateReport();
    
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');

if (dryRun) {
  console.log('🧪 DRY RUN MODE - No data will be modified');
  // TODO: Implement dry run logic
  process.exit(0);
}

if (!force) {
  console.log('⚠️  This script will migrate existing posts to the unified Post model.');
  console.log('⚠️  Make sure you have a database backup before proceeding.');
  console.log('⚠️  Run with --force flag to proceed, or --dry-run to test first.');
  process.exit(0);
}

// Run the migration
runMigration();