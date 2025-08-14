const mongoose = require('mongoose');
const { YapPost } = require('./yapPostModel');
const User = require('./userModel');
require('dotenv').config();

// Sample YAP posts data
const yapPostsData = [
  {
    title: "Late night conversation spots that serve good chai?",
    body: "Looking for those cozy places where you can sit for hours, have deep conversations, and the chai never gets cold. Preferably somewhere that doesn't judge you for occupying a table till 2 AM with just one order. 🫖",
    topic: "lifestyle",
    reactions: [
      { type: "heart" },
      { type: "heart" },
      { type: "laugh" },
      { type: "handshake" }
    ],
    comments: [
      {
        body: "Brahmin's Coffee Bar near Basavanagudi. The uncle there literally adopts you if you come regularly. Plus the filter coffee hits different at 1 AM.",
        featured: true
      },
      {
        body: "Try the 24/7 places in Koramangala. They're used to night owls like us!"
      }
    ]
  },
  {
    title: "Tired of pretending everything is fine at work",
    body: "Been putting on a smile for months while dealing with a toxic manager and impossible deadlines. The 'hustle culture' is killing my mental health. How do you deal with workplace burnout without quitting? I have bills to pay but I'm literally crying in office bathrooms. 😭",
    topic: "mental-health",
    reactions: [
      { type: "heart" },
      { type: "heart" },
      { type: "heart" },
      { type: "handshake" },
      { type: "fire" }
    ],
    comments: [
      {
        body: "Your mental health > any job. Document everything, set boundaries, and start looking for better opportunities. There are companies in Bangalore that actually care about work-life balance.",
        featured: true
      },
      {
        body: "I've been there. Consider talking to HR if you haven't already. Sometimes they can help mediate."
      },
      {
        body: "Sending you strength. You're not alone in this struggle. 💪"
      }
    ]
  },
  {
    title: "Unpopular opinion: Delhi's food scene is getting too touristy",
    body: "Everyone keeps talking about Chandni Chowk and Khan Market, but those places are packed with influencers now. Where's the authentic, affordable local food that doesn't require fighting crowds for a decent paratha? Missing the old hole-in-the-wall spots that actually fed locals. 🍽️",
    topic: "food",
    reactions: [
      { type: "laugh" },
      { type: "laugh" },
      { type: "skeptical" },
      { type: "fire" },
      { type: "handshake" }
    ],
    comments: [
      {
        body: "You're looking in the wrong places, friend. The real gems are in the residential areas. But locals don't share those spots with food bloggers for a reason 😉",
        featured: true
      }
    ]
  },
  {
    title: "That time I accidentally joined a company-wide video call while on the toilet",
    body: "So there I was, mid-business, when Teams decides to auto-connect me to the all-hands meeting. Spent 10 minutes trying to figure out why everyone looked confused while I'm frantically muting myself. The CEO was talking about 'commitment to excellence' while I'm... committed to something else entirely. 💀",
    topic: "humor",
    reactions: [
      { type: "laugh" },
      { type: "laugh" },
      { type: "laugh" },
      { type: "laugh" },
      { type: "fire" }
    ],
    comments: [
      {
        body: "This is why I keep my camera and mic off by default. Trust no technology during bathroom breaks.",
        featured: true
      },
      {
        body: "I'm crying 😂😂😂 This is peak WFH energy"
      }
    ]
  },
  {
    body: "Sometimes I sit by the backwaters and watch people rushing past, all lost in their phones or deadlines. Makes me wonder - when did we stop noticing the coconut palms, the birds, the simple fact that we're alive and breathing? Maybe the real productivity hack is just... being present. 🌳✨",
    topic: "mindfulness",
    reactions: [
      { type: "heart" },
      { type: "heart" },
      { type: "heart" },
      { type: "handshake" }
    ],
    comments: [
      {
        body: "This hit different. Thank you for the reminder to slow down and appreciate the moment."
      }
    ]
  },
  {
    title: "Sunrise trek to Kodaikanal - building a hiking family! 🌅",
    body: "Organizing weekly treks for people who want to escape the city chaos. No experience needed, just bring good vibes and comfortable shoes. We share costs, stories, and the most beautiful sunrises the Western Ghats have to offer. This Saturday: Kodaikanal at 4 AM! Who's in?",
    topic: "adventure",
    reactions: [
      { type: "fire" },
      { type: "heart" },
      { type: "handshake" },
      { type: "handshake" }
    ],
    comments: [
      {
        body: "Count me in! Been sitting in my apartment all week staring at screens. Need some mountain air and good company."
      },
      {
        body: "This sounds amazing! How do I join the group?"
      }
    ]
  }
];

async function seedYapData() {
  try {
    console.log('🌱 Starting YAP data seeding...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Clear existing YAP posts
    await YapPost.deleteMany({});
    console.log('🗑️ Cleared existing YAP posts');

    // Get some users to assign as authors
    const users = await User.find({}).limit(10);
    if (users.length === 0) {
      console.log('❌ No users found. Please create some users first.');
      process.exit(1);
    }
    console.log(`👥 Found ${users.length} users for post authors`);

    // Create YAP posts
    const createdPosts = [];
    
    for (let i = 0; i < yapPostsData.length; i++) {
      const postData = yapPostsData[i];
      const randomUser = users[Math.floor(Math.random() * users.length)];
      
      // Create the post
      const post = new YapPost({
        userId: randomUser._id,
        title: postData.title,
        body: postData.body,
        topic: postData.topic,
        state: randomUser.state,
        reactions: [],
        comments: []
      });

      // Add reactions with random users
      for (const reaction of postData.reactions) {
        const randomReactionUser = users[Math.floor(Math.random() * users.length)];
        post.reactions.push({
          userId: randomReactionUser._id,
          type: reaction.type
        });
      }

      // Add comments with random users
      for (const comment of postData.comments) {
        const randomCommentUser = users[Math.floor(Math.random() * users.length)];
        post.comments.push({
          userId: randomCommentUser._id,
          body: comment.body,
          featured: comment.featured || false
        });
      }

      // Add some random views
      post.metrics.views = Math.floor(Math.random() * 100) + 10;

      await post.save();
      createdPosts.push(post);
      
      console.log(`📝 Created YAP post: "${post.title || post.body.substring(0, 50)}..."`);
    }

    console.log(`✅ Successfully seeded ${createdPosts.length} YAP posts!`);
    
    // Display summary
    const totalPosts = await YapPost.countDocuments({});
    const totalReactions = createdPosts.reduce((sum, post) => sum + post.reactions.length, 0);
    const totalComments = createdPosts.reduce((sum, post) => sum + post.comments.length, 0);
    
    console.log('\n📊 YAP Seeding Summary:');
    console.log(`   Posts: ${totalPosts}`);
    console.log(`   Reactions: ${totalReactions}`);
    console.log(`   Comments: ${totalComments}`);
    console.log(`   Topics: ${[...new Set(createdPosts.map(p => p.topic))].join(', ')}`);

  } catch (error) {
    console.error('❌ YAP seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the seeding function
if (require.main === module) {
  seedYapData();
}

module.exports = { seedYapData };