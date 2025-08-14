const express = require('express');
const { z } = require('zod');
const TeaIslandPost = require('./teaIslandPostModel');
const Notification = require('./notificationModel');
const auth = require('./middleware/auth');
const asyncWrap = require('./utils/asyncWrap');
const router = express.Router();

// Enhanced image URL validation
const urlArr = z.array(z.string().url().refine(u => /^https?:\/\//.test(u), {
  message: "Only HTTP/HTTPS URLs are allowed"
})).max(6);

// Validation schemas
const createPostSchema = z.object({
  title: z.string().max(200),
  content: z.string().min(1).max(5000),
  category: z.string(),
  subcategory: z.string().optional(),
  images: urlArr.optional()
});

// Create a new post (Tea/Island)
router.post('/posts', auth, asyncWrap(async (req, res) => {
  try {
    const { title, content, category, subcategory } = req.body;
    const user = req.user;

    // Validation
    if (!title || !content || !category || !subcategory) {
      return res.status(400).json({
        error: 'Title, content, category, and subcategory are required'
      });
    }

    if (title.length > 200) {
      return res.status(400).json({
        error: 'Title must be 200 characters or less'
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        error: 'Content must be 5000 characters or less'
      });
    }

    // Determine tab based on user's gender
    const tab = user.gender === 'female' ? 'tea' : 'island';

    // Validate subcategory matches tab
    const teaSubcategories = ['girl-talk', 'k-fanatic', 'hot-topics', 'glow-up'];
    const islandSubcategories = ['brotherhood', 'anime', 'gym-rat', 'hustle'];

    if (tab === 'tea' && !teaSubcategories.includes(subcategory)) {
      return res.status(400).json({
        error: 'Invalid subcategory for Tea tab'
      });
    }

    if (tab === 'island' && !islandSubcategories.includes(subcategory)) {
      return res.status(400).json({
        error: 'Invalid subcategory for Island tab'
      });
    }

    // Create post
    const post = new TeaIslandPost({
      title,
      content,
      author: user._id || user.userId,
      authorUsername: user.username,
      tab,
      category,
      subcategory,
      state: user.state
    });

    await post.save();

    console.log(`📝 New ${tab} post created by ${user.username}: "${title}"`);

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        id: post._id,
        title: post.title,
        content: post.content,
        author: post.authorUsername,
        tab: post.tab,
        category: post.category,
        subcategory: post.subcategory,
        state: post.state,
        votes: post.votes,
        reactions: post.reactions,
        replies: post.replies,
        views: post.views,
        isHot: post.isHot,
        isPinned: post.isPinned,
        createdAt: post.createdAt,
        lastActivity: post.lastActivity
      }
    });

  } catch (error) {
    console.error('Post creation error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
}));

// Create a new general forum post
router.post('/general/:state/posts', auth, asyncWrap(async (req, res) => {
  try {
    const { title, content, category, subcategory } = req.body;
    const { state } = req.params;
    const user = req.user;

    // State access control - users can only post in their own state
    if (user.state !== state) {
      return res.status(403).json({
        error: "Access denied. You can only post and comment in your own state's forum."
      });
    }

    // Validation
    if (!title || !content || !category) {
      return res.status(400).json({
        error: 'Title, content, and category are required'
      });
    }

    if (title.length > 200) {
      return res.status(400).json({
        error: 'Title must be 200 characters or less'
      });
    }

    if (content.length > 5000) {
      return res.status(400).json({
        error: 'Content must be 5000 characters or less'
      });
    }

    // Validate category for general forums
    const validCategories = ['discussion', 'question', 'hot', 'news'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: 'Invalid category for general forum'
      });
    }

    // Validate subcategory for general forums (optional)
    const generalSubcategories = ['local-news', 'community', 'help', 'events'];
    if (subcategory && !generalSubcategories.includes(subcategory)) {
      return res.status(400).json({
        error: 'Invalid subcategory for general forum'
      });
    }

    // Create post
    const post = new TeaIslandPost({
      title,
      content,
      author: user._id || user.userId,
      authorUsername: user.username,
      tab: 'general',
      category,
      subcategory: subcategory || null,
      state: user.state
    });

    await post.save();

    console.log(`📝 New general forum post created by ${user.username} in ${state}: "${title}"`);

    res.status(201).json({
      message: 'Post created successfully',
      post: {
        id: post._id,
        title: post.title,
        content: post.content,
        author: post.authorUsername,
        tab: post.tab,
        category: post.category,
        subcategory: post.subcategory,
        state: post.state,
        votes: post.votes,
        reactions: post.reactions,
        replies: post.replies,
        views: post.views,
        isHot: post.isHot,
        isPinned: post.isPinned,
        createdAt: post.createdAt,
        lastActivity: post.lastActivity
      }
    });

  } catch (error) {
    console.error('General forum post creation error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
}));

// Get general forum posts for a specific state
router.get('/general/:state/posts', asyncWrap(async (req, res) => {
  try {
    const { state } = req.params;
    const { 
      category, 
      subcategory, 
      sort = 'recent', 
      page = 1, 
      limit = 25 
    } = req.query;

    console.log(`📖 GET general forum posts for ${state} - Category: ${category || 'all'}, Subcategory: ${subcategory || 'all'}, Sort: ${sort}`);

    // Build query
    const query = { 
      tab: 'general',
      state,
      isActive: true 
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (subcategory && subcategory !== 'all') {
      query.subcategory = subcategory;
    }

    // Build sort options
    let sortOptions = {};
    switch (sort) {
      case 'hot':
        sortOptions = { isHot: -1, 'votes.up': -1, reactions: -1, createdAt: -1 };
        break;
      case 'top':
        sortOptions = { 'votes.up': -1, reactions: -1, createdAt: -1 };
        break;
      case 'recent':
      default:
        sortOptions = { isPinned: -1, createdAt: -1 };
        break;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const posts = await TeaIslandPost.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username karma')
      .lean();

    // Get total count for pagination
    const total = await TeaIslandPost.countDocuments(query);
    
    console.log(`📊 Query: ${JSON.stringify(query)}`);
    console.log(`📊 Found ${posts.length} posts, total matching: ${total} in ${state} general forum`);

    // Format posts for response
    const formattedPosts = posts.map(post => ({
      id: post._id,
      title: post.title,
      content: post.content.substring(0, 300) + (post.content.length > 300 ? '...' : ''),
      author: post.authorUsername,
      authorKarma: post.author?.karma || 0,
      tab: post.tab,
      category: post.category,
      subcategory: post.subcategory,
      state: post.state,
      votes: post.votes,
      reactions: post.reactions,
      replies: post.replies,
      views: post.views,
      isHot: post.isHot,
      isPinned: post.isPinned,
      createdAt: post.createdAt,
      lastActivity: post.lastActivity,
      timestamp: getRelativeTime(post.createdAt)
    }));

    res.json({
      posts: formattedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('General forum posts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
}));

// Get posts for a specific tab (tea or island)
router.get('/posts/:tab', asyncWrap(async (req, res) => {
  try {
    const { tab } = req.params;
    const { 
      category, 
      subcategory, 
      state, 
      sort = 'recent', 
      page = 1, 
      limit = 25 
    } = req.query;

    console.log(`📖 GET /${tab} posts - Category: ${category || 'all'}, Subcategory: ${subcategory || 'all'}, Sort: ${sort}`);

    // Validate tab
    if (!['tea', 'island', 'general'].includes(tab)) {
      return res.status(400).json({ error: 'Invalid tab. Must be tea, island, or general' });
    }

    // Build query
    const query = { 
      tab, 
      isActive: true 
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    if (subcategory && subcategory !== 'all') {
      query.subcategory = subcategory;
    }

    if (state && state !== 'all') {
      query.state = state;
    }

    // Build sort options
    let sortOptions = {};
    switch (sort) {
      case 'hot':
        sortOptions = { isHot: -1, 'votes.up': -1, reactions: -1, createdAt: -1 };
        break;
      case 'trending':
        // Use aggregation for trending posts
        const trendingPosts = await TeaIslandPost.getTrending(tab, parseInt(limit));
        return res.json({
          posts: trendingPosts,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: trendingPosts.length
          }
        });
      case 'top':
        sortOptions = { 'votes.up': -1, reactions: -1, createdAt: -1 };
        break;
      case 'recent':
      default:
        sortOptions = { isPinned: -1, createdAt: -1 };
        break;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const posts = await TeaIslandPost.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('author', 'username karma')
      .lean();

    // Get total count for pagination
    const total = await TeaIslandPost.countDocuments(query);
    const totalAllPosts = await TeaIslandPost.countDocuments({ tab });
    
    console.log(`📊 Query: ${JSON.stringify(query)}`);
    console.log(`📊 Found ${posts.length} posts, total matching: ${total}, total in ${tab}: ${totalAllPosts}`);

    // Format posts for response
    const formattedPosts = posts.map(post => ({
      id: post._id,
      title: post.title,
      content: post.content.substring(0, 300) + (post.content.length > 300 ? '...' : ''),
      author: post.authorUsername,
      authorKarma: post.author?.karma || 0,
      tab: post.tab,
      category: post.category,
      subcategory: post.subcategory,
      state: post.state,
      votes: post.votes,
      reactions: post.reactions,
      replies: post.replies,
      views: post.views,
      isHot: post.isHot,
      isPinned: post.isPinned,
      createdAt: post.createdAt,
      lastActivity: post.lastActivity,
      timestamp: getRelativeTime(post.createdAt)
    }));

    res.json({
      posts: formattedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Posts fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
}));

// Get a single post by ID
router.get('/posts/:tab/:postId', asyncWrap(async (req, res) => {
  try {
    const { tab, postId } = req.params;

    const post = await TeaIslandPost.findOne({ 
      _id: postId, 
      tab, 
      isActive: true 
    }).populate('author', 'username karma');

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Increment view count
    await TeaIslandPost.findByIdAndUpdate(postId, { $inc: { views: 1 } });

    res.json({
      post: {
        id: post._id,
        title: post.title,
        content: post.content,
        author: post.authorUsername,
        authorKarma: post.author?.karma || 0,
        tab: post.tab,
        category: post.category,
        subcategory: post.subcategory,
        state: post.state,
        votes: post.votes,
        reactions: post.reactions,
        replies: post.replies,
        views: post.views + 1,
        isHot: post.isHot,
        isPinned: post.isPinned,
        createdAt: post.createdAt,
        lastActivity: post.lastActivity,
        timestamp: getRelativeTime(post.createdAt)
      }
    });

  } catch (error) {
    console.error('Post fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
}));

// Vote on a post
router.post('/posts/:tab/:postId/vote', auth, asyncWrap(async (req, res) => {
  try {
    const { tab, postId } = req.params;
    const { vote } = req.body; // 'up', 'down', or 'remove'
    const userId = req.user._id || req.user.userId;

    if (!['up', 'down', 'remove'].includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    const post = await TeaIslandPost.findOne({ _id: postId, tab, isActive: true });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Check existing vote
    const existingVoteIndex = post.votes.users.findIndex(
      v => v.userId.toString() === userId.toString()
    );

    if (vote === 'remove') {
      // Remove existing vote
      if (existingVoteIndex !== -1) {
        const existingVote = post.votes.users[existingVoteIndex];
        if (existingVote.vote === 'up') {
          post.votes.up = Math.max(0, post.votes.up - 1);
        } else {
          post.votes.down = Math.max(0, post.votes.down - 1);
        }
        post.votes.users.splice(existingVoteIndex, 1);
      }
    } else {
      // Add or update vote
      if (existingVoteIndex !== -1) {
        // Update existing vote
        const existingVote = post.votes.users[existingVoteIndex];
        if (existingVote.vote !== vote) {
          // Change vote type
          if (existingVote.vote === 'up') {
            post.votes.up = Math.max(0, post.votes.up - 1);
            post.votes.down += 1;
          } else {
            post.votes.down = Math.max(0, post.votes.down - 1);
            post.votes.up += 1;
          }
          existingVote.vote = vote;
        }
      } else {
        // Add new vote
        post.votes.users.push({ userId, vote });
        if (vote === 'up') {
          post.votes.up += 1;
        } else {
          post.votes.down += 1;
        }
      }
    }

    await post.save();

    console.log(`👍 Vote ${vote} on ${tab} post "${post.title}" by ${req.user.username}`);

    // Create notification for post author (only for upvotes, not downvotes or removes)
    try {
      if (vote === 'up' && post.author.toString() !== userId.toString()) {
        await Notification.createNotification({
          recipient: post.author,
          sender: userId,
          type: 'post_like',
          title: 'Post Liked',
          message: `${req.user.username} liked your post: "${post.title.substring(0, 50)}${post.title.length > 50 ? '...' : ''}"`,
          actionUrl: `/posts/${tab}/${post._id}`,
          relatedPost: post._id,
          senderUsername: req.user.username,
          senderState: req.user.state
        });
        console.log(`🔔 Notification sent to post author for upvote`);
      }
    } catch (notificationError) {
      console.error('❌ Failed to create vote notification:', notificationError);
      // Don't fail the vote if notification fails
    }

    res.json({
      message: 'Vote recorded successfully',
      votes: post.votes,
      userVote: post.getUserVote(userId)
    });

  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
}));

// React to a post
router.post('/posts/:tab/:postId/react', auth, asyncWrap(async (req, res) => {
  try {
    const { tab, postId } = req.params;
    const userId = req.user._id || req.user.userId;

    const post = await TeaIslandPost.findOne({ _id: postId, tab, isActive: true });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const hasReacted = post.hasUserReacted(userId);

    if (hasReacted) {
      // Remove reaction
      post.reactionUsers.pull(userId);
      post.reactions = Math.max(0, post.reactions - 1);
    } else {
      // Add reaction
      post.reactionUsers.push(userId);
      post.reactions += 1;
    }

    await post.save();

    const action = hasReacted ? 'removed' : 'added';
    console.log(`💖 Reaction ${action} on ${tab} post "${post.title}" by ${req.user.username}`);

    // Create notification for post author (only when adding reaction, not removing)
    try {
      if (!hasReacted && post.author.toString() !== userId.toString()) {
        await Notification.createNotification({
          recipient: post.author,
          sender: userId,
          type: 'post_reaction',
          title: 'Post Reaction',
          message: `${req.user.username} reacted to your post: "${post.title.substring(0, 50)}${post.title.length > 50 ? '...' : ''}"`,
          actionUrl: `/posts/${tab}/${post._id}`,
          relatedPost: post._id,
          senderUsername: req.user.username,
          senderState: req.user.state
        });
        console.log(`🔔 Notification sent to post author for reaction`);
      }
    } catch (notificationError) {
      console.error('❌ Failed to create reaction notification:', notificationError);
      // Don't fail the reaction if notification fails
    }

    res.json({
      message: `Reaction ${action} successfully`,
      reactions: post.reactions,
      hasReacted: !hasReacted
    });

  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ error: 'Failed to record reaction' });
  }
}));

// Debug endpoint to check database status
router.get('/debug/status', asyncWrap(async (req, res) => {
  try {
    const teaCount = await TeaIslandPost.countDocuments({ tab: 'tea' });
    const islandCount = await TeaIslandPost.countDocuments({ tab: 'island' });
    const totalCount = await TeaIslandPost.countDocuments({});
    
    const samplePosts = await TeaIslandPost.find({}).limit(3).lean();
    
    res.json({
      counts: {
        tea: teaCount,
        island: islandCount,
        total: totalCount
      },
      samplePosts: samplePosts.map(post => ({
        id: post._id,
        title: post.title,
        tab: post.tab,
        subcategory: post.subcategory,
        createdAt: post.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}));

// Helper function to get relative time
function getRelativeTime(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

module.exports = router;
