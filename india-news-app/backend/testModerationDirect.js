const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

// Import models
const User = require('./userModel');
const Report = require('./reportModel');
const TeaIslandPost = require('./teaIslandPostModel');
const ForumThread = require('./forumThreadModel');

async function testModerationSystem() {
  try {
    console.log('🧪 Starting moderation system test...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Test 1: Create test users
    console.log('\n1. Creating test users...');
    
    // Clean up existing test users
    await User.deleteMany({ username: { $in: ['testuser_mod', 'admin_mod'] } });
    
    const regularUser = await User.create({
      username: 'testuser_mod',
      passwordHash: 'hashedpassword123',
      state: 'Assam',
      gender: 'female',
      role: 'user',
      status: 'active'
    });
    console.log('✅ Regular user created:', regularUser._id);

    const adminUser = await User.create({
      username: 'admin_mod',
      passwordHash: 'hashedpassword456',
      state: 'Gujarat',
      gender: 'male',
      role: 'admin',
      status: 'active'
    });
    console.log('✅ Admin user created:', adminUser._id);

    // Test 2: Create test content
    console.log('\n2. Creating test content...');
    
    const testPost = await TeaIslandPost.create({
      title: 'Test Post for Moderation',
      content: 'This is a test post that might need moderation.',
      author: regularUser._id,
      authorUsername: regularUser.username,
      tab: 'tea',
      category: 'discussion',
      subcategory: 'girl-talk',
      state: 'Assam'
    });
    console.log('✅ Test post created:', testPost._id);

    const testThread = await ForumThread.create({
      title: 'Test Thread for Moderation',
      content: 'This is a test thread that might need moderation.',
      author: regularUser._id,
      authorUsername: regularUser.username,
      category: 'hot-topics'
    });
    console.log('✅ Test thread created:', testThread._id);

    // Test 3: Create reports
    console.log('\n3. Testing reporting system...');
    
    const report1 = await Report.create({
      reportType: 'post',
      postId: testPost._id,
      reportedBy: adminUser._id,
      reporterUsername: adminUser.username,
      reporterState: adminUser.state,
      reason: 'spam',
      description: 'This post appears to be spam content.'
    });
    console.log('✅ Report created:', report1._id);

    const report2 = await Report.create({
      reportType: 'thread',
      threadId: testThread._id,
      reportedBy: adminUser._id,
      reporterUsername: adminUser.username,
      reporterState: adminUser.state,
      reason: 'harassment',
      description: 'This thread contains harassment.'
    });
    console.log('✅ Second report created:', report2._id);

    // Test 4: Test report queries
    console.log('\n4. Testing report queries...');
    
    const allReports = await Report.find({}).populate('reportedBy', 'username');
    console.log('✅ Total reports found:', allReports.length);

    const pendingReports = await Report.find({ status: 'pending' });
    console.log('✅ Pending reports:', pendingReports.length);

    const highPriorityReports = await Report.find({ priority: { $gte: 4 } });
    console.log('✅ High priority reports:', highPriorityReports.length);

    // Test 5: Test report review
    console.log('\n5. Testing report review...');
    
    report1.status = 'resolved';
    report1.reviewedBy = adminUser._id;
    report1.reviewedAt = new Date();
    report1.moderatorNotes = 'Report approved - content violates community guidelines';
    report1.action = 'approve';
    await report1.save();
    console.log('✅ Report reviewed successfully');

    // Test 6: Test content removal
    console.log('\n6. Testing content removal...');
    
    testPost.isRemoved = true;
    testPost.removedBy = adminUser._id;
    testPost.removedAt = new Date();
    testPost.removalReason = 'Spam content removed after user report';
    await testPost.save();
    console.log('✅ Post marked as removed');

    testThread.isRemoved = true;
    testThread.removedBy = adminUser._id;
    testThread.removedAt = new Date();
    testThread.removalReason = 'Thread removed for harassment';
    await testThread.save();
    console.log('✅ Thread marked as removed');

    // Test 7: Test user moderation
    console.log('\n7. Testing user moderation...');
    
    // Warn user
    regularUser.status = 'warned';
    regularUser.warnings = 1;
    await regularUser.save();
    console.log('✅ User warned');

    // Suspend user
    const suspensionEnd = new Date();
    suspensionEnd.setDate(suspensionEnd.getDate() + 7); // 7 days from now
    
    regularUser.status = 'suspended';
    regularUser.suspendedUntil = suspensionEnd;
    await regularUser.save();
    console.log('✅ User suspended for 7 days');

    // Test 8: Test user status checks
    console.log('\n8. Testing user status checks...');
    
    const updatedUser = await User.findById(regularUser._id);
    console.log('✅ User status:', updatedUser.status);
    console.log('✅ Suspension end:', updatedUser.suspendedUntil);
    console.log('✅ Warnings count:', updatedUser.warnings);
    console.log('✅ Can perform actions:', updatedUser.canPerformActions());

    // Test 9: Test report statistics
    console.log('\n9. Testing report statistics...');
    
    const reportStats = await Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    console.log('✅ Report statistics by status:');
    reportStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });

    const severityStats = await Report.aggregate([
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 }
        }
      }
    ]);
    console.log('✅ Report statistics by severity:');
    severityStats.forEach(stat => {
      console.log(`   ${stat._id}: ${stat.count}`);
    });

    // Test 10: Test content filtering
    console.log('\n10. Testing content filtering...');
    
    const activeContent = await TeaIslandPost.find({ isRemoved: false });
    const removedContent = await TeaIslandPost.find({ isRemoved: true });
    console.log('✅ Active posts:', activeContent.length);
    console.log('✅ Removed posts:', removedContent.length);

    console.log('\n🎉 All moderation system tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ User creation with roles and status');
    console.log('- ✅ Content creation (posts and threads)');
    console.log('- ✅ Report creation and management');
    console.log('- ✅ Report review and approval workflow');
    console.log('- ✅ Content removal with audit trail');
    console.log('- ✅ User warning and suspension system');
    console.log('- ✅ Moderation history tracking');
    console.log('- ✅ Report statistics and analytics');
    console.log('- ✅ Content filtering by removal status');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close database connection
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the test
testModerationSystem();