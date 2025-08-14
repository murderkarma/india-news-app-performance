const axios = require('axios');

const BASE_URL = 'http://localhost:8080';

async function testProfileRoutes() {
  try {
    console.log('🧪 Testing Profile System Routes...\n');

    // Test 1: Register a test user
    console.log('📝 Test 1: Registering test user...');
    const randomId = Math.floor(Math.random() * 1000);
    const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
      username: `proftest${randomId}`,
      password: 'testpass123',
      state: 'Mizoram',
      gender: 'female'
    });

    const token = registerResponse.data.token;
    const userId = registerResponse.data.user.id;
    console.log('✅ User registered successfully');

    // Test 2: Edit profile
    console.log('\n🎨 Test 2: Editing profile...');
    const editResponse = await axios.patch(`${BASE_URL}/api/users/edit-profile`, {
      bio: 'Hello! I love tea and coding 🌸☕',
      avatar: 'anime/anime_sakura.png',
      isDMEnabled: true,
      allowAnonDM: false
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('✅ Profile edited successfully:', editResponse.data.user);

    // Test 3: Get public profile
    console.log('\n👁️ Test 3: Getting public profile...');
    const profileResponse = await axios.get(`${BASE_URL}/api/users/${userId}/profile`);
    console.log('✅ Public profile retrieved:', {
      username: profileResponse.data.username,
      bio: profileResponse.data.bio,
      avatar: profileResponse.data.avatar,
      karma: profileResponse.data.karma,
      totalPosts: profileResponse.data.totalPosts,
      totalComments: profileResponse.data.totalComments,
      isDMEnabled: profileResponse.data.isDMEnabled
    });

    // Test 4: Get available avatars
    console.log('\n🎭 Test 4: Getting available avatars...');
    const avatarsResponse = await axios.get(`${BASE_URL}/api/users/avatars/list`);
    console.log('✅ Available avatars:', Object.keys(avatarsResponse.data.avatars));

    // Test 5: Check username availability
    console.log('\n🔍 Test 5: Checking username availability...');
    const usernameCheckResponse = await axios.get(`${BASE_URL}/api/users/check-username/newusername`);
    console.log('✅ Username check:', usernameCheckResponse.data);

    // Test 6: Try to edit profile with invalid bio (too long)
    console.log('\n❌ Test 6: Testing bio validation...');
    try {
      const longBio = 'a'.repeat(501);
      await axios.patch(`${BASE_URL}/api/users/edit-profile`, {
        bio: longBio
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('❌ Bio validation failed - should have rejected long bio');
    } catch (error) {
      console.log('✅ Bio validation working - rejected bio over 500 chars');
    }

    // Test 7: Try to access profile without authentication
    console.log('\n🔒 Test 7: Testing authentication requirement...');
    try {
      await axios.patch(`${BASE_URL}/api/users/edit-profile`, {
        bio: 'Should fail'
      });
      console.log('❌ Authentication check failed');
    } catch (error) {
      console.log('✅ Authentication required for profile editing');
    }

    // Test 8: Try to get non-existent user profile
    console.log('\n🚫 Test 8: Testing non-existent user profile...');
    try {
      await axios.get(`${BASE_URL}/api/users/507f1f77bcf86cd799439011/profile`);
      console.log('❌ Should have returned 404 for non-existent user');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Correctly returned 404 for non-existent user');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n🎉 All profile route tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testProfileRoutes();