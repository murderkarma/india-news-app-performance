const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://sap3358:Xxx123!!@northeastnews.ib5fuac.mongodb.net/?retryWrites=true&w=majority&appName=northeastnews';

// Define the Tea Post schema (matching your backend structure)
const teaPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  authorKarma: { type: Number, default: 0 },
  tab: { type: String, default: 'tea' },
  category: { type: String, required: true },
  subcategory: { type: String, required: true },
  state: { type: String, required: true },
  votes: {
    up: { type: Number, default: 0 },
    down: { type: Number, default: 0 }
  },
  reactions: { type: Number, default: 0 },
  replies: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  isHot: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  timestamp: { type: String, default: () => new Date().toISOString() }
});

const TeaPost = mongoose.model('TeaPost', teaPostSchema);

const samplePosts = [
  {
    title: "Just got my first job offer and I'm literally crying happy tears! 😭✨",
    content: "Besties, after 6 months of job hunting, rejections, and self-doubt, I finally got THE call! The salary is more than I expected and the company culture seems amazing. I can't believe this is real! 💕",
    author: "femaletestuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "girl-talk",
    state: "Manipur",
    votes: { up: 42, down: 1 },
    reactions: 28,
    replies: 15,
    views: 234,
    isHot: true
  },
  {
    title: "Red flags in dating that we need to stop ignoring 🚩",
    content: "Ladies, let's talk about those subtle red flags we often brush off: love bombing, not respecting boundaries, making you feel guilty for having standards. What are some you've learned to watch out for?",
    author: "femaletestuser",
    authorKarma: 50,
    category: "hot",
    subcategory: "love-dating",
    state: "Manipur",
    votes: { up: 67, down: 3 },
    reactions: 45,
    replies: 32,
    views: 456,
    isHot: true
  },
  {
    title: "Affordable skincare routine that actually works? Help a girl out! 💄",
    content: "My skin has been acting up lately and I'm on a student budget. What are your holy grail products under ₹500? Looking for something for combination skin with occasional breakouts.",
    author: "femaletestuser",
    authorKarma: 50,
    category: "question",
    subcategory: "glow-up",
    state: "Manipur",
    votes: { up: 23, down: 0 },
    reactions: 18,
    replies: 24,
    views: 189,
    isHot: false
  },
  {
    title: "BTS comeback has me in my feels again 😭💜",
    content: "The new music video dropped and I'm not okay! The visuals, the vocals, everything is perfect. Anyone else completely obsessed? Let's fangirl together! 🇰🇷",
    author: "femaletestuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "k-fanatic",
    state: "Manipur",
    votes: { up: 38, down: 2 },
    reactions: 31,
    replies: 19,
    views: 287,
    isHot: true
  },
  {
    title: "That awkward moment when your crush likes your old Instagram post 👀",
    content: "He went back 47 weeks deep into my feed and liked a random selfie from last year. What does this MEAN?! I'm overthinking everything now. Help me decode this behavior please! 😅",
    author: "femaletestuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "tea-confessions",
    state: "Manipur",
    votes: { up: 52, down: 1 },
    reactions: 35,
    replies: 28,
    views: 378,
    isHot: false
  },
  {
    title: "College professors who don't reply to emails are the worst 😤",
    content: "Sent three emails about my assignment deadline and NOTHING. But they expect us to reply within 24 hours. The double standard is real and I'm so done with this energy!",
    author: "femaletestuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "petty-rants",
    state: "Manipur",
    votes: { up: 45, down: 2 },
    reactions: 29,
    replies: 16,
    views: 298,
    isHot: false
  },
  {
    title: "Deepika vs Alia - who wore it better at the awards show? 👗",
    content: "Both looked absolutely stunning but I can't decide! Deepika's saree was elegant and timeless, but Alia's lehenga was so dreamy and romantic. What do you all think?",
    author: "femaletestuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "bollywood",
    state: "Manipur",
    votes: { up: 31, down: 4 },
    reactions: 22,
    replies: 21,
    views: 267,
    isHot: false
  },
  {
    title: "Is it just me or are crop tops getting shorter every season? 🤔",
    content: "Went shopping today and literally every top barely covers anything! I love showing some skin but where are the cute tops that don't require a sports bra underneath? Fashion is confusing me lately.",
    author: "femaletestuser",
    authorKarma: 50,
    category: "hot",
    subcategory: "fashion-beauty",
    state: "Manipur",
    votes: { up: 29, down: 6 },
    reactions: 19,
    replies: 18,
    views: 203,
    isHot: false
  }
];

async function seedTeaData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing Tea posts
    await TeaPost.deleteMany({});
    console.log('🗑️ Cleared existing Tea posts');

    // Insert sample posts
    const insertedPosts = await TeaPost.insertMany(samplePosts);
    console.log(`✅ Inserted ${insertedPosts.length} Tea posts`);

    console.log('\n📊 Sample posts created:');
    insertedPosts.forEach((post, index) => {
      console.log(`${index + 1}. "${post.title}" (${post.category}/${post.subcategory})`);
    });

    console.log('\n🎉 Tea seeding completed successfully!');
    console.log('You can now test the Tea tab with sample data.');

  } catch (error) {
    console.error('❌ Error seeding Tea data:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedTeaData();