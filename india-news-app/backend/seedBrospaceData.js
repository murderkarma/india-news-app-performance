const mongoose = require('mongoose');

// MongoDB connection
const MONGODB_URI = 'mongodb+srv://sap3358:Xxx123!!@northeastnews.ib5fuac.mongodb.net/?retryWrites=true&w=majority&appName=northeastnews';

// Define the Brospace Post schema (matching your backend structure)
const brospacePostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, required: true },
  authorKarma: { type: Number, default: 0 },
  tab: { type: String, default: 'brospace' },
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

const BrospacePost = mongoose.model('BrospacePost', brospacePostSchema);

const samplePosts = [
  {
    title: "Started hitting the gym consistently - feeling like a different person",
    content: "Bros, I've been going to the gym for 3 months straight now and the mental gains are insane. Not just talking about the physical changes, but my confidence is through the roof. Anyone else experience this transformation?",
    author: "testuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "fitness",
    state: "Assam",
    votes: { up: 23, down: 2 },
    reactions: 15,
    replies: 8,
    views: 156,
    isHot: true
  },
  {
    title: "How do you guys handle rejection?",
    content: "Got turned down by this girl I really liked. I know it's part of life but damn it stings. What's your mindset when dealing with this stuff? Need some brotherhood wisdom here.",
    author: "testuser",
    authorKarma: 50,
    category: "question",
    subcategory: "dating",
    state: "Assam",
    votes: { up: 18, down: 1 },
    reactions: 12,
    replies: 15,
    views: 203,
    isHot: false
  },
  {
    title: "Unpopular opinion: Social media is destroying our generation's mental health",
    content: "Hear me out - we're constantly comparing ourselves to highlight reels, getting dopamine hits from likes, and losing real human connection. I deleted Instagram 2 weeks ago and feel so much better. Thoughts?",
    author: "testuser",
    authorKarma: 50,
    category: "hot",
    subcategory: "mentality",
    state: "Assam",
    votes: { up: 31, down: 7 },
    reactions: 22,
    replies: 19,
    views: 287,
    isHot: true
  },
  {
    title: "Started a side hustle selling custom phone cases - made ₹15k this month",
    content: "Been designing and selling custom phone cases online. Started with ₹2000 investment, now making decent money. The key is finding your niche and being consistent. Happy to share tips if anyone's interested.",
    author: "testuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "hustle",
    state: "Assam",
    votes: { up: 45, down: 3 },
    reactions: 28,
    replies: 12,
    views: 342,
    isHot: true
  },
  {
    title: "Gaming addiction is real - how I broke free",
    content: "Used to spend 8+ hours daily gaming, grades were trash, social life non-existent. Took me 6 months to break the cycle. Now I game 2-3 hours max on weekends. Here's what worked for me...",
    author: "testuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "escape",
    state: "Assam",
    votes: { up: 27, down: 4 },
    reactions: 18,
    replies: 11,
    views: 198,
    isHot: false
  },
  {
    title: "Why do people think being 'alpha' means being an asshole?",
    content: "Real alpha energy is about being confident, respectful, and lifting others up. Not putting people down or being toxic. We need to redefine what masculinity means in 2024.",
    author: "testuser",
    authorKarma: 50,
    category: "hot",
    subcategory: "mentality",
    state: "Assam",
    votes: { up: 52, down: 8 },
    reactions: 35,
    replies: 24,
    views: 456,
    isHot: true
  },
  {
    title: "Best budget meal prep ideas for college students?",
    content: "Living on a tight budget but trying to eat healthy and build muscle. What are your go-to cheap meals that actually taste good? Rice and chicken is getting old lol",
    author: "testuser",
    authorKarma: 50,
    category: "question",
    subcategory: "fitness",
    state: "Assam",
    votes: { up: 16, down: 1 },
    reactions: 9,
    replies: 18,
    views: 134,
    isHot: false
  },
  {
    title: "That friend who only hits you up when they need something",
    content: "You know the type - disappears for months, then suddenly texts when they need a favor. Just happened again and I'm done with this energy. Time to set some boundaries.",
    author: "testuser",
    authorKarma: 50,
    category: "discussion",
    subcategory: "roasts",
    state: "Assam",
    votes: { up: 38, down: 2 },
    reactions: 25,
    replies: 16,
    views: 289,
    isHot: false
  }
];

async function seedBrospaceData() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing Brospace posts
    await BrospacePost.deleteMany({});
    console.log('🗑️ Cleared existing Brospace posts');

    // Insert sample posts
    const insertedPosts = await BrospacePost.insertMany(samplePosts);
    console.log(`✅ Inserted ${insertedPosts.length} Brospace posts`);

    console.log('\n📊 Sample posts created:');
    insertedPosts.forEach((post, index) => {
      console.log(`${index + 1}. "${post.title}" (${post.category}/${post.subcategory})`);
    });

    console.log('\n🎉 Brospace seeding completed successfully!');
    console.log('You can now test the Brospace tab with sample data.');

  } catch (error) {
    console.error('❌ Error seeding Brospace data:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedBrospaceData();