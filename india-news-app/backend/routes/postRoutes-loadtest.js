/**
 * Simplified Post Routes for Load Testing
 * Minimal version without push notifications for performance testing
 */

const express = require('express');
const { z } = require('zod');
const { Post, REACTION_TYPES, SPACE_CONFIG } = require('../models/postModel');
const { authenticateToken } = require('../authRoutes');
const asyncWrap = require('../utils/asyncWrap');

const router = express.Router();

// Enhanced image URL validation
const urlArr = z.array(z.string().url().refine(u => /^https?:\/\//.test(u), {
  message: "Only HTTP/HTTPS URLs are allowed"
})).max(6);

// Validation schemas
const createPostSchema = z.object({
  space: z.enum(['yap', 'tea', 'brospace', 'local']),
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(8000),
  images: urlArr.optional(),
  topic: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
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

// Post formatter
function formatPost(post, userId = null, space = null) {
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
    category: post.category || post.topic,
    subcategory: post.subcategory,
    state: post.state,
    author: {
      id: post.userId,
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

// 1. POST /api/posts - Create new post
router.post('/', authenticateToken, asyncWrap(async (req, res) => {
  try {
    const validatedData = createPostSchema.parse(req.body);
    const { space } = validatedData;
    
    const postData = {
      space,
      userId: req.user._id || req.user.userId,
      title: validatedData.title,
      body: validatedData.body,
      images: validatedData.images || [],
      state: validatedData.state || req.user.state
    };
    
    if (space === 'yap') {
      postData.topic = validatedData.topic || validatedData.category;
    } else {
      postData.topic = validatedData.category || validatedData.topic;
      postData.subcategory = validatedData.subcategory;
    }
    
    const post = new Post(postData);
    await post.save();

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: formatPost(post, req.user._id || req.user.userId, space)
    });

  } catch (error) {
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

// 2. GET /api/posts - Get posts with filtering
router.get('/', asyncWrap(async (req, res) => {
  try {
    const { space, sort, cursor, limit, topic, category, state } = querySchema.parse(req.query);
    
    const query = { space, isActive: true };
    
    if (topic || category) {
      query.topic = topic || category;
    }
    
    if (state) {
      query.state = state;
    }
    
    if (cursor) {
      query._id = { $lt: cursor };
    }
    
    let sortOptions = {};
    switch (sort) {
      case 'new':
        sortOptions = { createdAt: -1 };
        break;
      case 'trending':
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
    
    const posts = await Post.find(query)
      .sort(sortOptions)
      .limit(limit + 1)
      .populate('userId', 'username karma state gender')
      .lean();
    
    const hasMore = posts.length > limit;
    if (hasMore) {
      posts.pop();
    }
    
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
    
    res.json({
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
    });

  } catch (error) {
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

// 3. POST /api/posts/:id/react - React to a post
router.post('/:id/react', authenticateToken, asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.userId;
    
    const { type } = reactionSchema.parse(req.body);
    
    const post = await Post.findOne({ _id: id, isActive: true });
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }
    
    const existingReaction = post.getUserReaction(userId);
    
    if (existingReaction === type) {
      await post.removeReaction(userId);
    } else {
      await post.updateReaction(userId, type);
    }
    
    res.status(204).send();

  } catch (error) {
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

// 4. POST /api/posts/:id/comments - Add comment
router.post('/:id/comments', authenticateToken, asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.userId;
    
    const { body } = commentSchema.parse(req.body);
    
    const post = await Post.findOne({ _id: id, isActive: true });
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found',
        code: 'POST_NOT_FOUND'
      });
    }
    
    await post.addComment(userId, body);
    
    const createdComment = post.comments[post.comments.length - 1];
    
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

// 5. GET /api/posts/:id - Get single post
router.get('/:id', asyncWrap(async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? (req.user._id || req.user.userId) : null;
    
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
    
    post.metrics.views += 1;
    await post.save();
    
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
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post',
      code: 'FETCH_FAILED'
    });
  }
}));

module.exports = router;