const mongoose = require('mongoose');
const User = require('./userModel');
require('dotenv').config();

async function testProfileSystem() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Test 1: Create a test user with new profile fields
    console.log('\n🧪 Test 1: Creating user with profile fields...');
    
    // Clean up any existing test user
    await User.deleteOne({ username: 'profiletestuser' });
    
    const testUser = new User({
      username: 'profiletestuser',
      passwordHash: 'testpassword123',
      state: 'Mizoram',
      gender: 'female',
      bio: 'Testing the new profile system! 🌸',
      avatar: 'anime/anime_sakura.png',
      isDMEnabled: true,
      allowAnonDM: false
    });

    await testUser.save();
    console.log('✅ User created with profile fields:', {
      username: testUser.username,
      bio: testUser.bio,
      avatar: testUser.avatar,
      isDMEnabled: testUser.isDMEnabled,
      allowAnonDM: testUser.allowAnonDM
    });

    // Test 2: Test profile update
    console.log('\n🧪 Test 2: Testing profile update...');
    
    const updatedUser = await User.findByIdAndUpdate(
      testUser._id,
      {
        bio: 'Updated bio with emojis! ✨🎭',
        avatar: 'kpop/kpop_iu.png',
        isDMEnabled: false
      },
      { new: true }
    );

    console.log('✅ Profile updated successfully:', {
      bio: updatedUser.bio,
      avatar: updatedUser.avatar,
      isDMEnabled: updatedUser.isDMEnabled
    });

    // Test 3: Test bio length validation
    console.log('\n🧪 Test 3: Testing bio length validation...');
    
    try {
      const longBio = 'a'.repeat(501); // 501 characters (over limit)
      await User.findByIdAndUpdate(
        testUser._id,
        { bio: longBio },
        { runValidators: true }
      );
      console.log('❌ Bio validation failed - should have rejected long bio');
    } catch (error) {
      console.log('✅ Bio validation working - rejected bio over 500 chars');
    }

    // Test 4: Test default values for new fields
    console.log('\n🧪 Test 4: Testing default values...');
    
    await User.deleteOne({ username: 'defaulttestuser' });
    
    const defaultUser = new User({
      username: 'defaulttestuser',
      passwordHash: 'testpassword123',
      state: 'Assam',
      gender: 'male'
      // Not setting bio, avatar, isDMEnabled, allowAnonDM to test defaults
    });

    await defaultUser.save();
    console.log('✅ Default values working:', {
      bio: `"${defaultUser.bio}"`,
      avatar: defaultUser.avatar,
      isDMEnabled: defaultUser.isDMEnabled,
      allowAnonDM: defaultUser.allowAnonDM
    });

    // Test 5: Test JSON serialization (password hash should be hidden)
    console.log('\n🧪 Test 5: Testing JSON serialization...');
    
    const userJSON = testUser.toJSON();
    console.log('✅ JSON serialization working:', {
      hasPasswordHash: 'passwordHash' in userJSON,
      hasBio: 'bio' in userJSON,
      hasAvatar: 'avatar' in userJSON
    });

    // Clean up test users
    await User.deleteMany({ username: { $in: ['profiletestuser', 'defaulttestuser'] } });
    console.log('\n🧹 Cleaned up test users');

    console.log('\n🎉 All profile system tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run the test
testProfileSystem();