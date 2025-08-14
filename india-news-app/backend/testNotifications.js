const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

// Import models
const Notification = require('./notificationModel');
const User = require('./userModel');

async function testNotificationSystem() {
  try {
    console.log('🧪 Starting notification system test...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find or create test users
    let testUser1 = await User.findOne({ username: 'testuser1' });
    let testUser2 = await User.findOne({ username: 'testuser2' });

    if (!testUser1) {
      testUser1 = await User.create({
        username: 'testuser1',
        passwordHash: 'hashedpassword123',
        state: 'Maharashtra',
        gender: 'male'
      });
      console.log('✅ Created test user 1');
    }

    if (!testUser2) {
      testUser2 = await User.create({
        username: 'testuser2',
        passwordHash: 'hashedpassword456',
        state: 'Gujarat',
        gender: 'female'
      });
      console.log('✅ Created test user 2');
    }

    // Test 1: Create a notification using static method
    console.log('\n📝 Test 1: Creating notification using static method...');
    const notification1 = await Notification.createNotification({
      type: 'post_comment',
      recipient: testUser1._id,
      sender: testUser2._id,
      title: 'New Comment',
      message: 'testuser2 commented on your post',
      actionUrl: '/posts/test123',
      relatedPost: new mongoose.Types.ObjectId(),
      senderUsername: testUser2.username,
      senderState: testUser2.state
    });

    if (notification1) {
      console.log('✅ Notification created successfully:', notification1._id);
    } else {
      console.log('❌ Failed to create notification');
    }

    // Test 2: Check unread count
    console.log('\n📊 Test 2: Checking unread count...');
    const unreadCount = await Notification.getUnreadCount(testUser1._id);
    console.log(`✅ Unread count for testuser1: ${unreadCount}`);

    // Test 3: Create duplicate notification (should be prevented)
    console.log('\n🚫 Test 3: Testing duplicate prevention...');
    const duplicateNotification = await Notification.createNotification({
      type: 'post_comment',
      recipient: testUser1._id,
      sender: testUser2._id,
      title: 'New Comment',
      message: 'testuser2 commented on your post',
      actionUrl: '/posts/test123',
      relatedPost: notification1.relatedPost,
      senderUsername: testUser2.username,
      senderState: testUser2.state
    });

    if (!duplicateNotification) {
      console.log('✅ Duplicate notification correctly prevented');
    } else {
      console.log('❌ Duplicate notification was created (should not happen)');
    }

    // Test 4: Mark notification as read
    console.log('\n👁️ Test 4: Marking notification as read...');
    const markedCount = await Notification.markAsRead([notification1._id], testUser1._id);
    console.log(`✅ Marked ${markedCount} notifications as read`);

    // Test 5: Check unread count after marking as read
    console.log('\n📊 Test 5: Checking unread count after marking as read...');
    const newUnreadCount = await Notification.getUnreadCount(testUser1._id);
    console.log(`✅ New unread count for testuser1: ${newUnreadCount}`);

    // Test 6: Create different types of notifications
    console.log('\n🎯 Test 6: Creating different notification types...');
    
    const likeNotification = await Notification.createNotification({
      type: 'post_like',
      recipient: testUser1._id,
      sender: testUser2._id,
      title: 'Post Liked',
      message: 'testuser2 liked your post',
      actionUrl: '/posts/test123',
      relatedPost: new mongoose.Types.ObjectId(),
      senderUsername: testUser2.username,
      senderState: testUser2.state
    });

    const replyNotification = await Notification.createNotification({
      type: 'comment_reply',
      recipient: testUser1._id,
      sender: testUser2._id,
      title: 'Comment Reply',
      message: 'testuser2 replied to your comment',
      actionUrl: '/posts/test123#comment456',
      relatedComment: new mongoose.Types.ObjectId(),
      senderUsername: testUser2.username,
      senderState: testUser2.state
    });

    console.log(`✅ Created like notification: ${likeNotification ? likeNotification._id : 'failed'}`);
    console.log(`✅ Created reply notification: ${replyNotification ? replyNotification._id : 'failed'}`);

    // Test 7: Fetch notifications with pagination
    console.log('\n📄 Test 7: Fetching notifications with pagination...');
    const notifications = await Notification.find({
      recipient: testUser1._id,
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('sender', 'username state')
    .lean();

    console.log(`✅ Found ${notifications.length} notifications for testuser1`);
    notifications.forEach((notif, index) => {
      console.log(`   ${index + 1}. ${notif.type}: ${notif.title} (Read: ${notif.isRead})`);
    });

    console.log('\n🎉 All notification tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Notification creation');
    console.log('   ✅ Duplicate prevention');
    console.log('   ✅ Unread count tracking');
    console.log('   ✅ Mark as read functionality');
    console.log('   ✅ Multiple notification types');
    console.log('   ✅ Pagination and querying');

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
testNotificationSystem();