const mongoose = require('mongoose');
const User = require('./userModel');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://sap3358:Xxx123!!@northeastnews.ib5fuac.mongodb.net/?retryWrites=true&w=majority&appName=northeastnews';

async function createFemaleTestUser() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check if female test user already exists
    const existingUser = await User.findOne({ username: 'femaletestuser' });
    if (existingUser) {
      console.log('✅ Female test user already exists');
      console.log('Username: femaletestuser');
      console.log('Password: test123');
      console.log('State:', existingUser.state);
      console.log('Gender:', existingUser.gender);
      process.exit(0);
    }

    // Create female test user
    const femaleTestUser = new User({
      username: 'femaletestuser',
      passwordHash: 'test123', // This will be hashed by the pre-save middleware
      state: 'Manipur',
      gender: 'female',
      karma: 50
    });

    await femaleTestUser.save();
    console.log('✅ Female test user created successfully!');
    console.log('Username: femaletestuser');
    console.log('Password: test123');
    console.log('State: Manipur');
    console.log('Gender: female');
    console.log('');
    console.log('You can now use these credentials to test the Tea tab functionality.');

  } catch (error) {
    console.error('❌ Error creating female test user:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

createFemaleTestUser();