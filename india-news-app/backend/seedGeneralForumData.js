const mongoose = require('mongoose');
const TeaIslandPost = require('./teaIslandPostModel');
const User = require('./userModel');
require('dotenv').config();

// Sample users for testing
const sampleUsers = [
  {
    username: "GuwahatiCommuter",
    passwordHash: "password123",
    state: "Assam",
    gender: "male"
  },
  {
    username: "FoodieExplorer",
    passwordHash: "password123",
    state: "Assam",
    gender: "female"
  },
  {
    username: "BihuOrganizer",
    passwordHash: "password123",
    state: "Assam",
    gender: "male"
  },
  {
    username: "LanguageLearner",
    passwordHash: "password123",
    state: "Assam",
    gender: "female"
  },
  {
    username: "TrafficWoes",
    passwordHash: "password123",
    state: "Assam",
    gender: "male"
  },
  {
    username: "EcoWarrior",
    passwordHash: "password123",
    state: "Assam",
    gender: "female"
  }
];

const sampleGeneralForumPostsTemplate = [
  {
    title: "New Metro Line Opening in Guwahati - What are your thoughts?",
    content: "The new metro line is finally opening next month! This is going to change everything for daily commuters. Has anyone tried the test runs? How's the connectivity?",
    authorUsername: "GuwahatiCommuter",
    tab: "general",
    category: "news",
    subcategory: "local-news",
    state: "Assam",
    votes: { up: 23, down: 2 },
    reactions: 15,
    replies: 8,
    views: 156,
    isHot: true,
    isPinned: false
  },
  {
    title: "Looking for good Assamese restaurants in Guwahati",
    content: "I'm visiting Guwahati next week and want to try authentic Assamese cuisine. Any recommendations for restaurants that serve traditional dishes like khar, tenga, and pitika?",
    authorUsername: "FoodieExplorer",
    tab: "general",
    category: "question",
    subcategory: "community",
    state: "Assam",
    votes: { up: 12, down: 0 },
    reactions: 7,
    replies: 15,
    views: 89,
    isHot: false,
    isPinned: false
  },
  {
    title: "Bihu Festival Preparations - Community Event Planning",
    content: "We're organizing a community Bihu celebration this year! Looking for volunteers to help with decorations, food arrangements, and cultural programs. Let's make this the best Bihu celebration ever!",
    authorUsername: "BihuOrganizer",
    tab: "general",
    category: "discussion",
    subcategory: "events",
    state: "Assam",
    votes: { up: 45, down: 1 },
    reactions: 28,
    replies: 22,
    views: 203,
    isHot: true,
    isPinned: true
  },
  {
    title: "Need help with Assamese language learning resources",
    content: "I'm trying to learn Assamese but finding it difficult to get good learning materials. Can anyone suggest books, apps, or online resources? Also looking for language exchange partners.",
    authorUsername: "LanguageLearner",
    tab: "general",
    category: "question",
    subcategory: "help",
    state: "Assam",
    votes: { up: 18, down: 0 },
    reactions: 12,
    replies: 11,
    views: 67,
    isHot: false,
    isPinned: false
  },
  {
    title: "Traffic situation in Guwahati is getting worse every day",
    content: "The traffic congestion in Guwahati has become unbearable. It takes 2 hours to travel what should be a 30-minute journey. When will the authorities take serious action? The metro can't come soon enough!",
    authorUsername: "TrafficWoes",
    tab: "general",
    category: "hot",
    subcategory: "local-news",
    state: "Assam",
    votes: { up: 67, down: 8 },
    reactions: 34,
    replies: 29,
    views: 245,
    isHot: true,
    isPinned: false
  },
  {
    title: "Community Clean-up Drive at Brahmaputra Riverfront",
    content: "Join us this Sunday for a community clean-up drive at the Brahmaputra riverfront. Let's work together to keep our beautiful river clean! Bring gloves and water bottles. Refreshments will be provided.",
    authorUsername: "EcoWarrior",
    tab: "general",
    category: "discussion",
    subcategory: "community",
    state: "Assam",
    votes: { up: 31, down: 0 },
    reactions: 19,
    replies: 14,
    views: 112,
    isHot: false,
    isPinned: false
  }
];

async function seedGeneralForumData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing general forum posts
    await TeaIslandPost.deleteMany({ tab: 'general' });
    console.log('Cleared existing general forum posts');

    // Create or find test users
    const userMap = new Map();
    
    for (const userData of sampleUsers) {
      let user = await User.findOne({ username: userData.username });
      
      if (!user) {
        user = new User(userData);
        await user.save();
        console.log(`Created user: ${userData.username}`);
      } else {
        console.log(`Found existing user: ${userData.username}`);
      }
      
      userMap.set(userData.username, user._id);
    }

    // Create posts with proper author ObjectIds
    const postsWithAuthors = sampleGeneralForumPostsTemplate.map((post, index) => ({
      ...post,
      author: userMap.get(post.authorUsername),
      createdAt: new Date(Date.now() - (index * 3600000)), // Stagger posts by 1 hour each
      updatedAt: new Date(Date.now() - (index * 3600000)),
      lastActivity: new Date(Date.now() - (index * 1800000)), // Last activity 30 mins after creation
    }));

    // Insert sample posts
    const insertedPosts = await TeaIslandPost.insertMany(postsWithAuthors);
    console.log(`Inserted ${insertedPosts.length} general forum posts`);

    console.log('General forum data seeded successfully!');
    
    // Log some sample posts for verification
    console.log('\nSample posts created:');
    insertedPosts.slice(0, 3).forEach(post => {
      console.log(`- ${post.title} (${post.category}/${post.subcategory}) by ${post.authorUsername}`);
    });

  } catch (error) {
    console.error('Error seeding general forum data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seeding function
if (require.main === module) {
  seedGeneralForumData();
}

module.exports = seedGeneralForumData;