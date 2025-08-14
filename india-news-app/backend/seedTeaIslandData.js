const mongoose = require('mongoose');
const TeaIslandPost = require('./teaIslandPostModel');
const User = require('./userModel');
require('dotenv').config();

const teaSeedPosts = [
  {
    title: '🔥 Bollywood Breakup Drama is UNREAL',
    content: 'The tea is scalding hot besties! That power couple everyone shipped just called it quits and the details are messy. I\'m not naming names but if you know, you know. The Instagram unfollowing, the cryptic stories, the friend group choosing sides - it\'s giving main character energy and I\'m here for it. What do you think really happened? Drop your theories below! 👀',
    category: 'hot',
    subcategory: 'hot-topics',
    votes: { up: 45, down: 2 },
    reactions: 234,
    replies: 12,
    views: 890,
    isHot: true
  },
  {
    title: '💅 Glass Skin Routine That Actually Works',
    content: 'Finally found the perfect 7-step routine for that Korean glass skin glow. No expensive products needed, just consistency and the right ingredients. I\'ve been testing this for 3 months and the results are insane! My skin has never looked better. Here\'s exactly what I do every morning and night...',
    category: 'discussion',
    subcategory: 'glow-up',
    votes: { up: 23, down: 1 },
    reactions: 156,
    replies: 8,
    views: 445
  },
  {
    title: '💬 Unpopular Opinion: Long Distance is Worth It',
    content: 'Everyone says LDR never works but here I am 2 years strong. Sometimes the wait makes it more beautiful. Yes it\'s hard, yes there are tears, but when you find your person, distance is just a number. The key is communication, trust, and having your own life. Here\'s what I\'ve learned...',
    category: 'discussion',
    subcategory: 'girl-talk',
    votes: { up: 15, down: 3 },
    reactions: 89,
    replies: 25,
    views: 234
  },
  {
    title: '🎭 BTS Jin\'s Solo Album is EVERYTHING',
    content: 'The vocals, the visuals, the EMOTION! Jin really said "let me show you what main vocalist energy looks like" and we are NOT ready. Every track hits different and don\'t even get me started on the music videos. The way he\'s serving looks and vocals simultaneously... This is what we call ART besties!',
    category: 'hot',
    subcategory: 'k-fanatic',
    votes: { up: 67, down: 1 },
    reactions: 567,
    replies: 45,
    views: 1234,
    isHot: true
  },
  {
    title: '✨ Confidence Glow Up: Mind Over Makeup',
    content: 'Real talk - the best glow up starts from within. Here are 5 mindset shifts that changed everything for me. It\'s not about the products you use or the clothes you wear, it\'s about how you carry yourself. Confidence is the best accessory and it\'s free! Let me share what worked for me...',
    category: 'discussion',
    subcategory: 'glow-up',
    votes: { up: 34, down: 0 },
    reactions: 445,
    replies: 18,
    views: 678
  }
];

const islandSeedPosts = [
  {
    title: '🤝 Brotherhood Code: Having Each Other\'s Back',
    content: 'Real men lift each other up. In a world trying to divide us, we stand united. Here\'s how to build unbreakable bonds with your crew. It\'s not about toxic masculinity, it\'s about genuine support, accountability, and being there when it matters. Brotherhood is earned, not given.',
    category: 'discussion',
    subcategory: 'brotherhood',
    votes: { up: 32, down: 1 },
    reactions: 187,
    replies: 15,
    views: 567,
    isHot: true
  },
  {
    title: '🔥 Attack on Titan Final Season Breakdown',
    content: 'The ending hit different. Eren\'s character development, the themes of freedom vs control - this anime changed everything. Isayama really said "let me destroy your emotions" and delivered. The way it explores war, humanity, and the cycle of hatred... This is peak storytelling. What did you think of the ending?',
    category: 'hot',
    subcategory: 'anime',
    votes: { up: 45, down: 3 },
    reactions: 234,
    replies: 28,
    views: 892
  },
  {
    title: '💪 Beast Mode: 5AM Club Challenge',
    content: 'Rise before the sun, conquer the day. Join the brotherhood of early risers who understand that discipline equals freedom. I\'ve been waking up at 5AM for 6 months now and it changed my life. More energy, better focus, crushing goals. Who\'s ready to join the challenge?',
    category: 'discussion',
    subcategory: 'gym-rat',
    votes: { up: 28, down: 2 },
    reactions: 156,
    replies: 12,
    views: 445
  },
  {
    title: '💰 Side Hustle That Actually Works',
    content: 'Turned my passion into profit. Here\'s the blueprint that took me from broke to 6 figures in 18 months. No get-rich-quick schemes, just real work and smart strategy. The key is finding something you\'re good at and solving real problems. Here\'s exactly how I did it...',
    category: 'hot',
    subcategory: 'hustle',
    votes: { up: 56, down: 2 },
    reactions: 298,
    replies: 34,
    views: 1123,
    isHot: true
  },
  {
    title: '🏋️ Push/Pull/Legs Split That Changed My Life',
    content: 'From skinny to swole in 2 years. This routine built the foundation. Progressive overload, consistency, and proper form - that\'s the holy trinity. No fancy equipment needed, just dedication. Here\'s the exact split that transformed my physique and mindset...',
    category: 'discussion',
    subcategory: 'gym-rat',
    votes: { up: 41, down: 1 },
    reactions: 189,
    replies: 22,
    views: 678
  }
];

async function seedTeaIslandPosts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing posts
    await TeaIslandPost.deleteMany({});
    console.log('Cleared existing Tea/Island posts');

    // Find some users to assign as authors
    const users = await User.find().limit(10);
    if (users.length === 0) {
      console.log('No users found. Please create some users first.');
      return;
    }

    // Create Tea posts
    const teaPosts = teaSeedPosts.map((post, index) => {
      const user = users[index % users.length];
      return {
        ...post,
        author: user._id,
        authorUsername: user.username,
        tab: 'tea',
        state: user.state,
        createdAt: new Date(Date.now() - (index + 1) * 2 * 60 * 60 * 1000), // Stagger creation times
        lastActivity: new Date(Date.now() - index * 30 * 60 * 1000)
      };
    });

    // Create Island posts
    const islandPosts = islandSeedPosts.map((post, index) => {
      const user = users[index % users.length];
      return {
        ...post,
        author: user._id,
        authorUsername: user.username,
        tab: 'island',
        state: user.state,
        createdAt: new Date(Date.now() - (index + 1) * 2 * 60 * 60 * 1000), // Stagger creation times
        lastActivity: new Date(Date.now() - index * 30 * 60 * 1000)
      };
    });

    // Insert posts
    const insertedTeaPosts = await TeaIslandPost.insertMany(teaPosts);
    const insertedIslandPosts = await TeaIslandPost.insertMany(islandPosts);

    console.log(`✅ Seeded ${insertedTeaPosts.length} Tea posts`);
    console.log(`✅ Seeded ${insertedIslandPosts.length} Island posts`);
    console.log('🎉 Tea/Island posts seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding Tea/Island posts:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seeding function
if (require.main === module) {
  seedTeaIslandPosts();
}

module.exports = seedTeaIslandPosts;