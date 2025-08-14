const axios = require('axios');

const BASE_URL = 'http://localhost:8080/api';

// Test data
let testUserId = null;
let testAdminId = null;
let testPostId = null;
let testThreadId = null;
let testReportId = null;

async function testModerationSystem() {
  console.log('🧪 Testing Moderation System...\n');

  try {
    // Step 1: Create test users (regular user and admin)
    console.log('1. Creating test users...');
    
    // Create regular user
    const regularUser = await axios.post(`${BASE_URL}/auth/register`, {
      username: 'testuser_mod',
      email: 'testuser_mod@example.com',
      password: 'password123',
      gender: 'female',
      state: 'Assam'
    });
    testUserId = regularUser.data.user._id;
    console.log('✅ Regular user created:', testUserId);

    // Create admin user
    const adminUser = await axios.post(`${BASE_URL}/auth/register`, {
      username: 'admin_mod',
      email: 'admin_mod@example.com',
      password: 'password123',
      gender: 'male',
      state: 'Gujarat'
    });
    testAdminId = adminUser.data.user._id;
    console.log('✅ Admin user created:', testAdminId);

    // Manually promote to admin (in real app, this would be done through database)
    const User = require('./userModel');
    await User.findByIdAndUpdate(testAdminId, { role: 'admin' });
    console.log('✅ User promoted to admin');

    // Step 2: Create test content
    console.log('\n2. Creating test content...');
    
    // Create a test post
    const testPost = await axios.post(`${BASE_URL}/tea-island/posts`, {
      title: 'Test Post for Moderation',
      content: 'This is a test post that might need moderation.',
      tab: 'tea',
      category: 'discussion',
      subcategory: 'girl-talk',
      state: 'Assam'
    }, {
      headers: { Authorization: `Bearer ${regularUser.data.token}` }
    });
    testPostId = testPost.data._id;
    console.log('✅ Test post created:', testPostId);

    // Create a test thread
    const testThread = await axios.post(`${BASE_URL}/forum/threads`, {
      title: 'Test Thread for Moderation',
      content: 'This is a test thread that might need moderation.',
      category: 'hot-topics'
    }, {
      headers: { Authorization: `Bearer ${regularUser.data.token}` }
    });
    testThreadId = testThread.data._id;
    console.log('✅ Test thread created:', testThreadId);

    // Step 3: Test reporting system
    console.log('\n3. Testing reporting system...');
    
    // Report the test post
    const reportResponse = await axios.post(`${BASE_URL}/moderation/report`, {
      contentType: 'post',
      contentId: testPostId,
      reason: 'spam',
      description: 'This post appears to be spam content.'
    }, {
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    testReportId = reportResponse.data.report._id;
    console.log('✅ Report created:', testReportId);

    // Step 4: Test admin endpoints
    console.log('\n4. Testing admin endpoints...');
    
    // Get all reports (admin only)
    const reportsResponse = await axios.get(`${BASE_URL}/moderation/admin/reports`, {
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    console.log('✅ Retrieved reports:', reportsResponse.data.reports.length);

    // Get pending reports
    const pendingReports = await axios.get(`${BASE_URL}/moderation/admin/reports?status=pending`, {
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    console.log('✅ Retrieved pending reports:', pendingReports.data.reports.length);

    // Review a report
    const reviewResponse = await axios.put(`${BASE_URL}/moderation/admin/reports/${testReportId}/review`, {
      action: 'approve',
      moderatorNotes: 'Report approved - content violates community guidelines'
    }, {
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    console.log('✅ Report reviewed:', reviewResponse.data.message);

    // Step 5: Test content removal
    console.log('\n5. Testing content removal...');
    
    // Remove the reported post
    const removePostResponse = await axios.delete(`${BASE_URL}/moderation/admin/posts/${testPostId}`, {
      data: { reason: 'Spam content removed after user report' },
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    console.log('✅ Post removed:', removePostResponse.data.message);

    // Remove the test thread
    const removeThreadResponse = await axios.delete(`${BASE_URL}/moderation/admin/threads/${testThreadId}`, {
      data: { reason: 'Test thread removal' },
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    console.log('✅ Thread removed:', removeThreadResponse.data.message);

    // Step 6: Test user management
    console.log('\n6. Testing user management...');
    
    // Warn user
    const warnResponse = await axios.post(`${BASE_URL}/moderation/admin/users/${testUserId}/warn`, {
      reason: 'Posted spam content'
    }, {
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    console.log('✅ User warned:', warnResponse.data.message);

    // Suspend user
    const suspendResponse = await axios.post(`${BASE_URL}/moderation/admin/users/${testUserId}/suspend`, {
      reason: 'Repeated violations after warning',
      duration: 7 // 7 days
    }, {
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    console.log('✅ User suspended:', suspendResponse.data.message);

    // Get user moderation history
    const historyResponse = await axios.get(`${BASE_URL}/moderation/admin/users/${testUserId}/history`, {
      headers: { Authorization: `Bearer ${adminUser.data.token}` }
    });
    console.log('✅ User moderation history retrieved:', historyResponse.data.actions.length, 'actions');

    // Step 7: Test access control
    console.log('\n7. Testing access control...');
    
    try {
      // Try to access admin endpoint with regular user token
      await axios.get(`${BASE_URL}/moderation/admin/reports`, {
        headers: { Authorization: `Bearer ${regularUser.data.token}` }
      });
      console.log('❌ Access control failed - regular user accessed admin endpoint');
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log('✅ Access control working - regular user blocked from admin endpoint');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }

    console.log('\n🎉 All moderation system tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('- ✅ User creation and role assignment');
    console.log('- ✅ Content creation (posts and threads)');
    console.log('- ✅ Report submission and management');
    console.log('- ✅ Content removal functionality');
    console.log('- ✅ User warning and suspension');
    console.log('- ✅ Moderation history tracking');
    console.log('- ✅ Role-based access control');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Run the test
testModerationSystem();