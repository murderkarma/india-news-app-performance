/**
 * Unified Post Routes - Enterprise-grade multi-space forum system
 * Consolidates YAP, Tea, Brospace, and Local into one powerful API
 * Reuses proven YAP architecture with space-based access control
 */

const express = require('express');
const { z } = require('zod');
const { Post, REACTION_TYPES, SPACE_CONFIG } = require('../models/postModel');
const Notification = require('../notificationModel');
const auth = require('../middleware/auth');
const asyncWrap = require('../utils/asyncWrap');
const feedCacheService = require('../services/feedCacheService');
const { limitWrites, limitReads } = require('../middleware/upstashRateLimit');
const { 
  spaceGate, 
  genderGate, 
  stateGate, 
  spaceValidationGate,
  createSpaceGate,
  loggingGate,
  moderationGate 
} = require('../middleware/gates');
const notificationTriggerService = require('../services/notificationTriggerService');

const router = express.Router();

// Enhanced image URL validation (reused from YAP)
const urlArr = z.array(z.string().url().refine(u => /^https?:\/\//.test(u), {
  message: "Only HTTP/HTTPS URLs are allowed"
})).max(6);

// Unified validation schemas
const createPostSchema = z.object({
  space: z.enum(['yap', 'tea', 'brospace', 'local']),
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(8000), // Will be further validated by space gates
  images: urlArr.optional(),
  topic: z.string().max(50).optional(), // For YAP
  category: z.string().max(50).optional(), // For Tea/Brospace/Local
  subcategory: z.string().max(50).optional(),
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
  space: z.enum(['yap', 'tea', 'brospace', 'local']),
  sort: z.enum(['hot', 'new', 'trending']).default('hot'),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
  topic: z.string().optional(),
  category: z.string().optional(),
  state: z.string().optional()
});

// Helper function to format timestamp (reused from YAP)
function getRelativeTime(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

// Enhanced post formatter with space-aware features
function formatPost(post, userId = null, space = null) {
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
    space: post.space,
    title: post.title,
    body: post.body,
    images: post.images || [],
    topic: post.topic,
    category: post.category || post.topic, // Backward compatibility
    subcategory: post.subcategory,
    state: post.state,
    author: {
      id: post.userId,
      // Note: In a real app, you'd populate this with user data
    },
    reactions: getReactionCounts(post.reactions || []),
    userReaction: userId ? getUserReaction(post.reactions || [], userId) : null,
    comments: post.comments ? post.comments.filter(c => !c.isRemoved).length : 0,
    metrics: post.metrics,
    isHot: post.isHot,
    isPinned: post.isPinned,
    timestamp: getRelativeTime(post.createdAt),
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    lastActivity: post.lastActivity
  };
}

// Apply space-specific gates based on request
const applySpaceGates = (req, res, next) => {
  const space = req.body.space || req.query.space || req.params.space;
  const config = SPACE_CONFIG[space];
  
  if (!config) {
    return res.status(400).json({
      success: false,
      error: `Invalid space: ${space}`,
      code: 'INVALID_SPACE'
    });
  }
  
  // Apply gates in sequence
  const gates = [];
  
  // Add logging
  gates.push(loggingGate(space));
  
  // Add moderation for write operations
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    gates.push(moderationGate(space));
    gates.push(spaceValidationGate(space));
  }
  
  // Add gender gate if required
  if (config.genderRequired && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
    gates.push(genderGate(config.genderRequired));
  }
  
  // Add state gate if space is state-restricted
  if (config.stateRestricted) {
    gates.push(stateGate(false));
  }
  
  // Execute gates in sequence
  let index = 0;
  const runNextGate = (err) => {
    if (err) return next(err);
    if (index >= gates.length) return next();
    
    const gate = gates[index++];
    gate(req, res, runNextGate);
  };
  
  runNextGate();
};

// 1. POST /api/posts - Create new post in any space
router.post('/', auth, limitWrites(), applySpaceGates, asyncWrap(async (req, res) => {
  try {
    // Validate request body
    const validatedData = createPostSchema.parse(req.body);
    const { space } = validatedData;
    
    console.log(`📝 POST /api/posts - Space: ${space}, User: ${req.user.username}`);
    
    // Create new post with space-specific defaults
    const postData = {
      space,
      userId: req.user._id || req.user.userId,
      title: validatedData.title,
      body: validatedData.body,
      images: validatedData.images || [],
      state: validatedData.state || req.user.state // Default to user's state
    };
    
    // Set topic or category based on space
    if (space === 'yap') {
      postData.topic = validatedData.topic || validatedData.category;
    } else {
      postData.topic = validatedData.category || validatedData.topic;
      postData.subcategory = validatedData.subcategory;
    }
    
    const post = new Post(postData);
    await post.save();
    
    console.log(`✅ ${space.toUpperCase()} post created: "${post.title || post.body.substring(0, 50)}..." by ${req.user.username}`);

    // Invalidate feed cache for this space
    await feedCacheService.invalidateSpace(space);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: formatPost(post, req.user._id || req.user.userId, space)
    });

  } catch (error) {
    console.error(`❌ ${req.body.space?.toUpperCase() || 'UNKNOWN'} post creation error:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create post',
      code: 'CREATION_FAILED'
    });
  }
}));

// 2. GET /api/posts - Get posts with space-based filtering and pagination (with Redis caching)
router.get('/', auth.optional, applySpaceGates, asyncWrap(async (req, res) => {
  try {
    // Validate query parameters
    const { space, sort, cursor, limit, topic, category, state } = querySchema.parse(req.query);
    
    console.log(`📖 GET /api/posts - Space: ${space}, Query: ${JSON.stringify(req.query)}`);
    
    // Try cache first (only for hot/new sorts without complex filters)
    const filters = { topic, category, state };
    const canCache = ['hot', 'new'].includes(sort) && !Object.values(filters).some(Boolean);
    
    if (canCache) {
      const cached = await feedCacheService.get(space, cursor, limit, filters);
      if (cached) {
        console.log(`📋 Cache HIT for ${space} feed`);
        return res.json(cached);
      }
    }
    
    // Build query
    const query = { space, isActive: true };
    
    // Add filters
    if (topic || category) {
      query.topic = topic || category;
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
        const trendingPosts = await Post.getTrending(space, limit);
        const formattedTrending = trendingPosts.map(post => formatPost(post, req.user?._id, space));
        
        return res.json({
          success: true,
          posts: formattedTrending,
          nextCursor: formattedTrending.length > 0 ? formattedTrending[formattedTrending.length - 1].id : null,
          hasMore: formattedTrending.length === limit,
          space,
          sort
        });
      case 'hot':
      default:
        sortOptions = { isPinned: -1, 'metrics.score': -1, createdAt: -1 };
        break;
    }
    
    // Execute query
    const posts = await Post.find(query)
      .sort(sortOptions)
      .limit(limit + 1) // Get one extra to check if there are more
      .populate('userId', 'username karma state gender')
      .lean();
    
    // Check if there are more posts
    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop(); // Remove the extra post
    }
    
    // Format posts for response
    const formattedPosts = posts.map(post => ({
      ...formatPost(post, req.user?._id, space),
      author: {
        id: post.userId._id,
        username: post.userId.username,
        karma: post.userId.karma,
        state: post.userId.state,
        gender: post.userId.gender
      }
    }));
    
    console.log(`📊 Found ${formattedPosts.length} ${space.toUpperCase()} posts (sort: ${sort})`);
    
    const response = {
      success: true,
      posts: formattedPosts,
      nextCursor: hasMore && formattedPosts.length > 0 ? formattedPosts[formattedPosts.length - 1].id : null,
      hasMore,
      space,
      pagination: {
        sort,
        limit,
        total: formattedPosts.length
      }
    };
    
    // Cache the response if eligible
    if (canCache && formattedPosts.length > 0) {
      await feedCacheService.set(space, cursor, limit, filters, response);
    }
    
    res.json(response);

  } catch (error) {
    console.error(`❌ ${req.query.space?.toUpperCase() || 'UNKNOWN'} posts fetch error:`, error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts',
      code: 'FETCH_FAILED'
    });
  }
}));

// 3. POST /api/posts/:id/react - React to a post (space-agnostic)
router.post('/:id/react', auth, limitWrites(), asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.userId;
    
    console.log(`💖 POST /api/posts/${id}/react - User: ${req.user.username}`);
    
    // Validate reaction type
    const { type } = reactionSchema.parse(req.body);
    
    // Find the post (space-agnostic)
    const post = await Post.findOne({ _id: id, isActive: true });
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }
    
    // Check if user already has this reaction
    const existingReaction = post.getUserReaction(userId);
    
    if (existingReaction === type) {
      // Remove reaction if it's the same type
      await post.removeReaction(userId);
      console.log(`🔄 Reaction removed: ${type} on ${post.space} post ${id} by ${req.user.username}`);
    } else {
      // Add or update reaction
      await post.updateReaction(userId, type);
      console.log(`✅ Reaction added: ${type} on ${post.space} post ${id} by ${req.user.username}`);
      
      // Create notification for post author (only for new reactions, not removals)
      try {
        if (post.userId.toString() !== userId.toString()) {
          await Notification.createNotification({
            recipient: post.userId,
            sender: userId,
            type: 'post_reaction',
            title: 'Post Reaction',
            message: `${req.user.username} reacted to your ${post.space} post: "${(post.title || post.body).substring(0, 50)}${(post.title || post.body).length > 50 ? '...' : ''}"`,
            actionUrl: `/${post.space}/${post._id}`,
            relatedPost: post._id,
            senderUsername: req.user.username,
            senderState: req.user.state
          });
          console.log(`🔔 Notification sent to post author for ${post.space} reaction`);
        }
      } catch (notificationError) {
        console.error('❌ Failed to create reaction notification:', notificationError);
        // Don't fail the reaction if notification fails
      }

      // Trigger push notification
      try {
        await notificationTriggerService.triggerReactionNotification({
          postId: post._id,
          postAuthorId: post.userId,
          reactorId: userId,
          reactor: req.user.username,
          reactionType: type,
          postTitle: post.title || post.body.substring(0, 50),
          space: post.space,
          reactorState: req.user.state
        });
      } catch (pushError) {
        console.error('❌ Failed to trigger push notification for reaction:', pushError);
        // Don't fail the reaction if push notification fails
      }
    }
    
    // Return updated reaction counts
    res.status(204).send(); // No content response as specified

  } catch (error) {
    console.error('❌ Post reaction error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reaction type',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to process reaction',
      code: 'REACTION_FAILED'
    });
  }
}));

// 4. POST /api/posts/:id/comments - Add comment to post (space-agnostic)
router.post('/:id/comments', auth, limitWrites(), asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.userId;
    
    console.log(`💬 POST /api/posts/${id}/comments - User: ${req.user.username}`);
    
    // Validate comment body
    const { body } = commentSchema.parse(req.body);
    
    // Find the post (space-agnostic)
    const post = await Post.findOne({ _id: id, isActive: true });
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }
    
    // Add comment using model method
    await post.addComment(userId, body);
    
    // Get the created comment (last one in array)
    const createdComment = post.comments[post.comments.length - 1];
    
    console.log(`✅ Comment added to ${post.space} post ${id} by ${req.user.username}`);
    
    // Create notification for post author (if not commenting on own post)
    try {
      if (post.userId.toString() !== userId.toString()) {
        await Notification.createNotification({
          recipient: post.userId,
          sender: userId,
          type: 'post_comment',
          title: 'New Comment',
          message: `${req.user.username} commented on your ${post.space} post: "${(post.title || post.body).substring(0, 50)}${(post.title || post.body).length > 50 ? '...' : ''}"`,
          actionUrl: `/${post.space}/${post._id}`,
          relatedPost: post._id,
          relatedComment: createdComment._id,
          senderUsername: req.user.username,
          senderState: req.user.state
        });
        console.log(`🔔 Notification sent to post author for ${post.space} comment`);
      }
    } catch (notificationError) {
      console.error('❌ Failed to create comment notification:', notificationError);
      // Don't fail the comment if notification fails
    }

    // Trigger push notification
    try {
      await notificationTriggerService.triggerCommentNotification({
        postId: post._id,
        postAuthorId: post.userId,
        commentAuthorId: userId,
        commentAuthor: req.user.username,
        postTitle: post.title || post.body.substring(0, 50),
        space: post.space,
        commentAuthorState: req.user.state
      });
    } catch (pushError) {
      console.error('❌ Failed to trigger push notification for comment:', pushError);
      // Don't fail the comment if push notification fails
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
    console.error('❌ Post comment error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid comment data',
        details: error.errors,
        code: 'VALIDATION_ERROR'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to add comment',
      code: 'COMMENT_FAILED'
    });
  }
}));

// 5. GET /api/posts/:id - Get single post with comments (space-agnostic)
router.get('/:id', auth.optional, asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.userId) : null;
    
    console.log(`📖 GET /api/posts/${id}`);
    
    // Find post and populate author and comment authors
    const post = await Post.findOne({ _id: id, isActive: true })
      .populate('userId', 'username karma state gender')
      .populate('comments.userId', 'username karma state');
    
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }
    
    // Increment view count
    post.metrics.views += 1;
    await post.save();
    
    // Format post with full comment details
    const formattedPost = {
      ...formatPost(post, userId, post.space),
      author: {
        id: post.userId._id,
        username: post.userId.username,
        karma: post.userId.karma,
        state: post.userId.state,
        gender: post.userId.gender
      },
      comments: post.comments
        .filter(comment => !comment.isRemoved)
        .map(comment => ({
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
    console.error('❌ Single post fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post',
      code: 'FETCH_FAILED'
    });
  }
}));

// Debug endpoint to check unified posts status across all spaces
router.get('/debug/status', asyncWrap(async (req, res) => {
  try {
    const stats = {};
    
    // Get counts for each space
    for (const space of ['yap', 'tea', 'brospace', 'local']) {
      const total = await Post.countDocuments({ space });
      const active = await Post.countDocuments({ space, isActive: true });
      const recent24h = await Post.countDocuments({
        space,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      });
      
      stats[space] = { total, active, recent24h };
    }
    
    // Get sample posts from each space
    const samplePosts = {};
    for (const space of ['yap', 'tea', 'brospace', 'local']) {
      const posts = await Post.find({ space, isActive: true })
        .limit(2)
        .populate('userId', 'username')
        .lean();
      
      samplePosts[space] = posts.map(post => ({
        id: post._id,
        title: post.title,
        body: post.body.substring(0, 100) + '...',
        author: post.userId?.username || 'Unknown',
        reactions: post.reactions.length,
        comments: post.comments.filter(c => !c.isRemoved).length,
        createdAt: post.createdAt
      }));
    }
    
    res.json({
      success: true,
      stats,
      samplePosts,
      spaceConfig: SPACE_CONFIG
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'DEBUG_FAILED'
    });
  }
}));

module.exports = router;