const mongoose = require('mongoose');
const ForumThread = require('./forumThreadModel');
const User = require('./userModel');
require('dotenv').config({ path: __dirname + '/.env' });

const sampleThreads = [
  {
    title: '🔥 That Bollywood couple breakup - what really happened?',
    content: 'Okay besties, I have some TEA about this whole situation. My friend works in the industry and apparently there\'s way more to this story than what the media is reporting. The timeline doesn\'t add up and there are some suspicious social media activities...',
    category: 'hot-topics',
    isSticky: true
  },
  {
    title: '💅 Drop your glass skin routine that actually works!',
    content: 'I\'ve been trying to achieve that Korean glass skin look for months and finally found a routine that works! It\'s all about the double cleansing and using the right acids. Here\'s my step-by-step process...',
    category: 'glow-up'
  },
  {
    title: '💬 Unpopular opinion: Long distance relationships can work',
    content: 'I know everyone says LDR never works but I\'ve been in one for 2 years and we\'re stronger than ever. Here\'s what we do to make it work and why I think people give up too easily...',
    category: 'girl-talk'
  },
  {
    title: '🌏 That influencer apology video discussion thread',
    content: 'Did anyone else watch that train wreck of an apology video? The crocodile tears, the notes app screenshot, the "I\'m learning and growing" speech... Let\'s break down everything wrong with it.',
    category: 'hot-topics'
  },
  {
    title: '✨ Share your confidence glow up journey',
    content: 'I want to hear about your confidence transformation! What changed for you? Was it therapy, a new mindset, cutting toxic people out? Share your story and inspire others!',
    category: 'glow-up'
  },
  {
    title: '💭 How I stopped chasing and started attracting',
    content: 'This mindset shift changed my entire dating life. I used to be the girl who would text first, plan everything, and basically do all the work. Here\'s how I learned to step back and let them come to me...',
    category: 'girl-talk'
  },
  {
    title: '🇰🇷 BTS Jin solo album appreciation thread',
    content: 'THE VOCALS, THE VISUALS, THE EMOTION! Jin really said "let me show you what main vocalist energy looks like" and we are NOT ready. This album is pure art and I need to discuss every single track.',
    category: 'k-fanatic',
    isSticky: true
  },
  {
    title: '💜 NewJeans comeback theories and predictions',
    content: 'Okay detectives, I\'ve been connecting the dots and I think I cracked the code for their next concept. The easter eggs are EVERYWHERE in their recent posts. Here\'s my theory...',
    category: 'k-fanatic'
  },
  {
    title: '🌟 BLACKPINK Lisa\'s fashion week looks breakdown',
    content: 'She really said "I\'m going to serve looks and make everyone else look basic" and honestly? Mission accomplished. Let\'s analyze every single outfit because the RANGE is incredible.',
    category: 'k-fanatic'
  },
  {
    title: '💄 Makeup looks that are actually wearable for everyday',
    content: 'Tired of those Instagram makeup tutorials that look amazing but take 2 hours? Here are some quick, everyday looks that still make you feel put together without the drama.',
    category: 'glow-up'
  }
];

async function seedForumData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the test user
    const testUser = await User.findOne({ username: 'testuser' });
    if (!testUser) {
      console.error('Test user not found. Please create a test user first.');
      return;
    }

    console.log('Found test user:', testUser.username);

    // Clear existing forum threads
    await ForumThread.deleteMany({});
    console.log('Cleared existing forum threads');

    // Create sample threads
    const threads = [];
    for (const threadData of sampleThreads) {
      const thread = new ForumThread({
        ...threadData,
        author: testUser._id,
        authorUsername: testUser.username,
        // Add some random likes and replies
        likes: Math.random() > 0.5 ? [{ user: testUser._id }] : [],
        replies: Math.random() > 0.7 ? [{
          author: testUser._id,
          authorUsername: testUser.username,
          content: 'This is so true! Thanks for sharing 💕',
          likes: []
        }] : []
      });

      // Set random timestamps within the last week
      const randomDays = Math.floor(Math.random() * 7);
      const randomHours = Math.floor(Math.random() * 24);
      thread.createdAt = new Date(Date.now() - (randomDays * 24 * 60 * 60 * 1000) - (randomHours * 60 * 60 * 1000));
      thread.lastActivity = new Date(thread.createdAt.getTime() + (Math.random() * 24 * 60 * 60 * 1000));

      threads.push(thread);
    }

    await ForumThread.insertMany(threads);
    console.log(`Created ${threads.length} sample forum threads`);

    console.log('Forum data seeded successfully!');
    process.exit(0);

  } catch (error) {
    console.error('Error seeding forum data:', error);
    process.exit(1);
  }
}

seedForumData();