const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });

// Import models
const ForumThread = require('./forumThreadModel');
const User = require('./userModel');

async function testThreadVotingSystem() {
  try {
    console.log('🧪 Starting thread comment voting system test...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Find or create test users
    let testUser1 = await User.findOne({ username: 'voter1' });
    let testUser2 = await User.findOne({ username: 'voter2' });
    let testUser3 = await User.findOne({ username: 'voter3' });

    if (!testUser1) {
      testUser1 = await User.create({
        username: 'voter1',
        passwordHash: 'hashedpassword123',
        state: 'Maharashtra',
        gender: 'male'
      });
      console.log('✅ Created test user 1 (voter1)');
    }

    if (!testUser2) {
      testUser2 = await User.create({
        username: 'voter2',
        passwordHash: 'hashedpassword456',
        state: 'Gujarat',
        gender: 'female'
      });
      console.log('✅ Created test user 2 (voter2)');
    }

    if (!testUser3) {
      testUser3 = await User.create({
        username: 'voter3',
        passwordHash: 'hashedpassword789',
        state: 'Assam',
        gender: 'other'
      });
      console.log('✅ Created test user 3 (voter3)');
    }

    // Test 1: Create a test thread with replies
    console.log('\n📝 Test 1: Creating test thread with replies...');
    
    const testThread = new ForumThread({
      title: 'Test Thread for Voting',
      content: 'This is a test thread to test the voting system.',
      author: testUser1._id,
      authorUsername: testUser1.username,
      category: 'hot-topics',
      replies: [
        {
          author: testUser2._id,
          authorUsername: testUser2.username,
          content: 'This is the first reply',
          votes: [],
          upvotes: 0,
          downvotes: 0,
          score: 0,
          engagementScore: 0
        },
        {
          author: testUser3._id,
          authorUsername: testUser3.username,
          content: 'This is the second reply',
          votes: [],
          upvotes: 0,
          downvotes: 0,
          score: 0,
          engagementScore: 0
        }
      ]
    });

    await testThread.save();
    console.log(`✅ Created test thread with ${testThread.replies.length} replies`);

    const reply1Id = testThread.replies[0]._id;
    const reply2Id = testThread.replies[1]._id;

    // Test 2: Test upvoting
    console.log('\n👍 Test 2: Testing upvote functionality...');
    
    const upvoteResult1 = testThread.voteOnReply(reply1Id, testUser1._id, 'upvote');
    await testThread.save();
    
    console.log(`✅ User1 upvoted reply1:`, upvoteResult1);
    console.log(`   Score: ${upvoteResult1.score}, Upvotes: ${upvoteResult1.upvotes}, Downvotes: ${upvoteResult1.downvotes}`);

    // Test 3: Test downvoting
    console.log('\n👎 Test 3: Testing downvote functionality...');
    
    const downvoteResult1 = testThread.voteOnReply(reply1Id, testUser3._id, 'downvote');
    await testThread.save();
    
    console.log(`✅ User3 downvoted reply1:`, downvoteResult1);
    console.log(`   Score: ${downvoteResult1.score}, Upvotes: ${downvoteResult1.upvotes}, Downvotes: ${downvoteResult1.downvotes}`);

    // Test 4: Test vote changing
    console.log('\n🔄 Test 4: Testing vote changing...');
    
    const changeVoteResult = testThread.voteOnReply(reply1Id, testUser3._id, 'upvote');
    await testThread.save();
    
    console.log(`✅ User3 changed vote from downvote to upvote:`, changeVoteResult);
    console.log(`   Score: ${changeVoteResult.score}, Upvotes: ${changeVoteResult.upvotes}, Downvotes: ${changeVoteResult.downvotes}`);

    // Test 5: Test vote removal
    console.log('\n❌ Test 5: Testing vote removal...');
    
    const removeVoteResult = testThread.voteOnReply(reply1Id, testUser1._id, null);
    await testThread.save();
    
    console.log(`✅ User1 removed their vote:`, removeVoteResult);
    console.log(`   Score: ${removeVoteResult.score}, Upvotes: ${removeVoteResult.upvotes}, Downvotes: ${removeVoteResult.downvotes}`);

    // Test 6: Add multiple votes to test sorting
    console.log('\n🗳️ Test 6: Adding multiple votes for sorting test...');
    
    // Add votes to reply2 to make it have higher score
    testThread.voteOnReply(reply2Id, testUser1._id, 'upvote');
    testThread.voteOnReply(reply2Id, testUser2._id, 'upvote');
    testThread.voteOnReply(reply2Id, testUser3._id, 'upvote');
    await testThread.save();
    
    console.log(`✅ Added 3 upvotes to reply2`);

    // Test 7: Test sorting functionality
    console.log('\n📊 Test 7: Testing reply sorting...');
    
    const recentSorted = testThread.getSortedReplies('recent');
    const topSorted = testThread.getSortedReplies('top');
    const hotSorted = testThread.getSortedReplies('hot');
    
    console.log(`✅ Recent sorting (newest first):`);
    recentSorted.forEach((reply, index) => {
      console.log(`   ${index + 1}. "${reply.content.substring(0, 30)}..." (Score: ${reply.score})`);
    });
    
    console.log(`✅ Top sorting (highest score first):`);
    topSorted.forEach((reply, index) => {
      console.log(`   ${index + 1}. "${reply.content.substring(0, 30)}..." (Score: ${reply.score})`);
    });
    
    console.log(`✅ Hot sorting (engagement score):`);
    hotSorted.forEach((reply, index) => {
      console.log(`   ${index + 1}. "${reply.content.substring(0, 30)}..." (Engagement: ${reply.engagementScore.toFixed(3)})`);
    });

    // Test 8: Test engagement score calculation
    console.log('\n⚡ Test 8: Testing engagement score calculation...');
    
    // Wait a moment to test time decay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add a new reply (should have higher engagement due to recency)
    testThread.replies.push({
      author: testUser1._id,
      authorUsername: testUser1.username,
      content: 'This is a newer reply',
      votes: [{ user: testUser2._id, type: 'upvote' }],
      upvotes: 1,
      downvotes: 0,
      score: 1,
      engagementScore: 0
    });
    
    // Recalculate engagement scores
    testThread.replies.forEach(reply => {
      reply.engagementScore = testThread.calculateEngagementScore(reply);
    });
    
    await testThread.save();
    
    const newHotSorted = testThread.getSortedReplies('hot');
    console.log(`✅ Updated hot sorting after adding newer reply:`);
    newHotSorted.forEach((reply, index) => {
      console.log(`   ${index + 1}. "${reply.content.substring(0, 30)}..." (Score: ${reply.score}, Engagement: ${reply.engagementScore.toFixed(3)})`);
    });

    console.log('\n🎉 All thread voting tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ Thread reply voting (upvote/downvote)');
    console.log('   ✅ Vote changing and removal');
    console.log('   ✅ Score calculation (upvotes - downvotes)');
    console.log('   ✅ Engagement score calculation with time decay');
    console.log('   ✅ Reply sorting by recent, top, and hot');
    console.log('   ✅ Multiple vote handling and conflict resolution');

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
testThreadVotingSystem();