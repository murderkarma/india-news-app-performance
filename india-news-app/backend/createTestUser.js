const mongoose = require('mongoose');
const User = require('./userModel');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://sap3358:Xxx123!!@northeastnews.ib5fuac.mongodb.net/?retryWrites=true&w=majority&appName=northeastnews';

async function createTestUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if test user already exists
    const existingUser = await User.findOne({ username: 'testuser' });
    if (existingUser) {
      console.log('✅ Test user already exists');
      console.log('Username: testuser');
      console.log('Password: test123');
      console.log('State:', existingUser.state);
      console.log('Gender:', existingUser.gender);
      process.exit(0);
    }

    // Create test user
    const testUser = new User({
      username: 'testuser',
      passwordHash: 'test123', // This will be hashed by the pre-save middleware
      state: 'Assam',
      gender: 'male',
      karma: 50
    });

    await testUser.save();
    console.log('✅ Test user created successfully!');
    console.log('Username: testuser');
    console.log('Password: test123');
    console.log('State: Assam');
    console.log('Gender: male');
    console.log('');
    console.log('You can now use these credentials to log in during development.');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createTestUser();