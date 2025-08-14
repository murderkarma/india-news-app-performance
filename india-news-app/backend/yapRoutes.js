const express = require('express');
const { z } = require('zod');
const { YapPost, REACTION_TYPES } = require('./yapPostModel');
const Notification = require('./notificationModel');
const { authenticateToken } = require('./authRoutes');
const asyncWrap = require('./utils/asyncWrap');
const router = express.Router();

// Enhanced image URL validation
const urlArr = z.array(z.string().url().refine(u => /^https?:\/\//.test(u), {
  message: "Only HTTP/HTTPS URLs are allowed"
})).max(6);

// Zod validation schemas
const createPostSchema = z.object({
  title: z.string().max(160).optional(),
  body: z.string().min(1).max(8000),
  images: urlArr.optional(),
  topic: z.string().max(50).optional(),
  state: z.enum([
    'Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland',
    'Arunachal Pradesh', 'Tripura', 'Sikkim',
    'Gujarat', 'Maharashtra'
  ]).optional()
});

const reactionSchema = z.object({
  type: z.enum(REACTION_TYPES)
});

const commentSchema = z.object({
  body: z.string().min(1).max(4000)
});

const querySchema = z.object({
  sort: z.enum(['hot', 'new', 'trending']).default('hot'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  topic: z.string().optional(),
  state: z.string().optional()
});

// Helper function to format timestamp
function getRelativeTime(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// Helper function to format post for response
function formatPost(post, userId = null) {
  // Handle both Mongoose documents and lean objects
  const getReactionCounts = (reactions) => {
    const counts = { heart: 0, laugh: 0, meh: 0, skeptical: 0, fire: 0, handshake: 0 };
    reactions.forEach(reaction => {
      counts[reaction.type] = (counts[reaction.type] || 0) + 1;
    });
    return counts;
  };

  const getUserReaction = (reactions, userId) => {
    if (!userId) return null;
    const userReaction = reactions.find(r => r.userId.toString() === userId.toString());
    return userReaction ? userReaction.type : null;
  };

  return {
    id: post._id,
    title: post.title,
    body: post.body,
    images: post.images,
    topic: post.topic,
    state: post.state,
    author: {
      id: post.userId,
      // Note: In a real app, you'd populate this with user data
    },
    reactions: getReactionCounts(post.reactions || []),
    userReaction: userId ? getUserReaction(post.reactions || [], userId) : null,
    comments: post.comments ? post.comments.length : 0,
    metrics: post.metrics,
    timestamp: getRelativeTime(post.createdAt),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
}

// 1. POST /api/yap - Create new YAP post
router.post('/', authenticateToken, asyncWrap(async (req, res) => {
  try {
    console.log(`📝 POST /api/yap - User: ${req.user.username}`);
    
    // Validate request body
    const validatedData = createPostSchema.parse(req.body);
    
    // Create new post
    const post = new YapPost({
      userId: req.user._id || req.user.userId,
      title: validatedData.title,
      body: validatedData.body,
      images: validatedData.images || [],
      topic: validatedData.topic,
      state: validatedData.state || req.user.state // Default to user's state
    });

    await post.save();
    
    console.log(`✅ YAP post created: "${post.title || post.body.substring(0, 50)}..." by ${req.user.username}`);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: formatPost(post, req.user._id || req.user.userId)
    });

  } catch (error) {
    console.error('❌ YAP post creation error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create post'
    });
  }
}));

// 2. GET /api/yap - Get YAP posts with pagination
router.get('/', asyncWrap(async (req, res) => {
  try {
    console.log(`📖 GET /api/yap - Query: ${JSON.stringify(req.query)}`);
    
    // Validate query parameters
    const { sort, cursor, limit, topic, state } = querySchema.parse(req.query);
    
    // Build query
    const query = { isActive: true };
    
    if (topic) {
      query.topic = topic;
    }
    
    if (state) {
      query.state = state;
    }
    
    // Add cursor pagination
    if (cursor) {
      query._id = { $lt: cursor };
    }
    
    // Build sort options
    let sortOptions = {};
    switch (sort) {
      case 'new':
        sortOptions = { createdAt: -1 };
        break;
      case 'trending':
        // Use the trending aggregation for recent popular posts
        const trendingPosts = await YapPost.getTrending(limit);
        const formattedTrending = trendingPosts.map(post => formatPost(post));
        
        return res.json({
          success: true,
          posts: formattedTrending,
          nextCursor: formattedTrending.length > 0 ? formattedTrending[formattedTrending.length - 1].id : null,
          hasMore: formattedTrending.length === limit
        });
      case 'hot':
      default:
        sortOptions = { 'metrics.score': -1, createdAt: -1 };
        break;
    }
    
    // Execute query
    const posts = await YapPost.find(query)
      .sort(sortOptions)
      .limit(limit + 1) // Get one extra to check if there are more
      .populate('userId', 'username karma state')
      .lean();
    
    // Check if there are more posts
    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop(); // Remove the extra post
    }
    
    // Format posts for response
    const formattedPosts = posts.map(post => ({
      ...formatPost(post),
      author: {
        id: post.userId._id,
        username: post.userId.username,
        karma: post.userId.karma,
        state: post.userId.state
      }
    }));
    
    console.log(`📊 Found ${formattedPosts.length} YAP posts (sort: ${sort})`);
    
    res.json({
      success: true,
      posts: formattedPosts,
      nextCursor: hasMore && formattedPosts.length > 0 ? formattedPosts[formattedPosts.length - 1].id : null,
      hasMore,
      pagination: {
        sort,
        limit,
        total: formattedPosts.length
      }
    });

  } catch (error) {
    console.error('❌ YAP posts fetch error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts'
    });
  }
}));

// 3. POST /api/yap/:id/react - React to a post
router.post('/:id/react', authenticateToken, asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.userId;
    
    console.log(`💖 POST /api/yap/${id}/react - User: ${req.user.username}`);
    
    // Validate reaction type
    const { type } = reactionSchema.parse(req.body);
    
    // Find the post
    const post = await YapPost.findOne({ _id: id, isActive: true });
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    // Check if user already has this reaction
    const existingReaction = post.getUserReaction(userId);
    
    if (existingReaction === type) {
      // Remove reaction if it's the same type
      await post.removeReaction(userId);
      console.log(`🔄 Reaction removed: ${type} on post ${id} by ${req.user.username}`);
    } else {
      // Add or update reaction
      await post.updateReaction(userId, type);
      console.log(`✅ Reaction added: ${type} on post ${id} by ${req.user.username}`);
      
      // Create notification for post author (only for new reactions, not removals)
      try {
        if (post.userId.toString() !== userId.toString()) {
          await Notification.createNotification({
            recipient: post.userId,
            sender: userId,
            type: 'post_reaction',
            title: 'Post Reaction',
            message: `${req.user.username} reacted to your post: "${(post.title || post.body).substring(0, 50)}${(post.title || post.body).length > 50 ? '...' : ''}"`,
            actionUrl: `/yap/${post._id}`,
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
    }
    
    // Return updated reaction counts
    res.status(204).send(); // No content response as specified

  } catch (error) {
    console.error('❌ YAP reaction error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reaction type',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process reaction'
    });
  }
}));

// 4. POST /api/yap/:id/comments - Add comment to post
router.post('/:id/comments', authenticateToken, asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.userId;
    
    console.log(`💬 POST /api/yap/${id}/comments - User: ${req.user.username}`);
    
    // Validate comment body
    const { body } = commentSchema.parse(req.body);
    
    // Find the post
    const post = await YapPost.findOne({ _id: id, isActive: true });
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    // Add comment
    const newComment = {
      userId: userId,
      body: body,
      featured: false
    };
    
    post.comments.push(newComment);
    await post.save();
    
    // Get the created comment (last one in array)
    const createdComment = post.comments[post.comments.length - 1];
    
    console.log(`✅ Comment added to post ${id} by ${req.user.username}`);
    
    // Create notification for post author (if not commenting on own post)
    try {
      if (post.userId.toString() !== userId.toString()) {
        await Notification.createNotification({
          recipient: post.userId,
          sender: userId,
          type: 'post_comment',
          title: 'New Comment',
          message: `${req.user.username} commented on your post: "${(post.title || post.body).substring(0, 50)}${(post.title || post.body).length > 50 ? '...' : ''}"`,
          actionUrl: `/yap/${post._id}`,
          relatedPost: post._id,
          relatedComment: createdComment._id,
          senderUsername: req.user.username,
          senderState: req.user.state
        });
        console.log(`🔔 Notification sent to post author for comment`);
      }
    } catch (notificationError) {
      console.error('❌ Failed to create comment notification:', notificationError);
      // Don't fail the comment if notification fails
    }
    
    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      comment: {
        id: createdComment._id,
        body: createdComment.body,
        author: {
          id: userId,
          username: req.user.username
        },
        featured: createdComment.featured,
        timestamp: getRelativeTime(createdComment.createdAt),
        createdAt: createdComment.createdAt
      }
    });

  } catch (error) {
    console.error('❌ YAP comment error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid comment data',
        details: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to add comment'
    });
  }
}));

// 5. GET /api/yap/:id - Get single post with comments
router.get('/:id', asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.userId) : null;
    
    console.log(`📖 GET /api/yap/${id}`);
    
    // Find post and populate author and comment authors
    const post = await YapPost.findOne({ _id: id, isActive: true })
      .populate('userId', 'username karma state')
      .populate('comments.userId', 'username karma state');
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found'
      });
    }
    
    // Increment view count
    post.metrics.views += 1;
    await post.save();
    
    // Format post with full comment details
    const formattedPost = {
      ...formatPost(post, userId),
      author: {
        id: post.userId._id,
        username: post.userId.username,
        karma: post.userId.karma,
        state: post.userId.state
      },
      comments: post.comments.map(comment => ({
        id: comment._id,
        body: comment.body,
        author: {
          id: comment.userId._id,
          username: comment.userId.username,
          karma: comment.userId.karma
        },
        featured: comment.featured,
        timestamp: getRelativeTime(comment.createdAt),
        createdAt: comment.createdAt
      }))
    };
    
    res.json({
      success: true,
      post: formattedPost
    });

  } catch (error) {
    console.error('❌ YAP single post fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post'
    });
  }
}));

// Debug endpoint to check YAP posts status
router.get('/debug/status', asyncWrap(async (req, res) => {
  try {
    const totalPosts = await YapPost.countDocuments({});
    const activePosts = await YapPost.countDocuments({ isActive: true });
    const recentPosts = await YapPost.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });
    
    const samplePosts = await YapPost.find({ isActive: true })
      .limit(3)
      .populate('userId', 'username')
      .lean();
    
    res.json({
      success: true,
      stats: {
        total: totalPosts,
        active: activePosts,
        recent24h: recentPosts
      },
      samplePosts: samplePosts.map(post => ({
        id: post._id,
        title: post.title,
        body: post.body.substring(0, 100) + '...',
        author: post.userId.username,
        reactions: post.reactions.length,
        comments: post.comments.length,
        createdAt: post.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}));

module.exports = router;