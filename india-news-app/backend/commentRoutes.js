const express = require('express');
const router = express.Router();
const Comment = require('./commentModel');
const TeaIslandPost = require('./teaIslandPostModel');
const Notification = require('./notificationModel');
const auth = require('./middleware/auth');

// Helper function to check state access for commenting
const checkStateAccess = async (postId, userState) => {
  try {
    const post = await TeaIslandPost.findById(postId);
    if (!post) {
      return { allowed: false, error: 'Post not found' };
    }
    
    // For tea/island posts, allow all users (no state restrictions)
    if (post.tab === 'tea' || post.tab === 'island') {
      return { allowed: true, post };
    }
    
    // For general posts, check state match
    if (post.state !== userState) {
      return { allowed: false, error: `Only members of ${post.state} can comment on this post` };
    }
    
    return { allowed: true, post };
  } catch (error) {
    return { allowed: false, error: 'Error checking post access' };
  }
};

// POST /comments - Create new comment
router.post('/', auth, async (req, res) => {
  try {
    console.log('🔥 POST /api/comments');
    const { postId, content } = req.body;
    const user = req.user;

    // Validation
    if (!postId || !content) {
      return res.status(400).json({ error: 'Post ID and content are required' });
    }

    if (content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: 'Comment too long (max 2000 characters)' });
    }

    // Check if post exists and user has access
    const accessCheck = await checkStateAccess(postId, user.state);
    if (!accessCheck.allowed) {
      return res.status(403).json({ error: accessCheck.error });
    }

    const post = accessCheck.post;

    // Create comment
    const comment = new Comment({
      postId,
      authorId: user._id || user.userId,
      content: content.trim(),
      authorUsername: user.username,
      authorState: user.state,
      postTab: post.tab
    });

    await comment.save();

    console.log(`💬 New comment created by ${user.username} on post: "${post.title}"`);

    // Create notification for post author (if not commenting on own post)
    try {
      if (post.author.toString() !== user._id.toString() && post.author.toString() !== user.userId.toString()) {
        await Notification.createNotification({
          recipient: post.author,
          sender: user._id || user.userId,
          type: 'post_comment',
          title: 'New Comment',
          message: `${user.username} commented on your post: "${post.title.substring(0, 50)}${post.title.length > 50 ? '...' : ''}"`,
          actionUrl: `/posts/${post.tab}/${post._id}`,
          relatedPost: post._id,
          relatedComment: comment._id,
          senderUsername: user.username,
          senderState: user.state
        });
        console.log(`🔔 Notification sent to post author for new comment`);
      }
    } catch (notificationError) {
      console.error('❌ Failed to create comment notification:', notificationError);
      // Don't fail the comment creation if notification fails
    }

    // Return the created comment
    res.status(201).json({
      success: true,
      comment: {
        _id: comment._id,
        content: comment.content,
        authorUsername: comment.authorUsername,
        authorState: comment.authorState,
        createdAt: comment.createdAt,
        timeAgo: comment.timeAgo,
        votes: comment.votes,
        edited: comment.edited
      }
    });

  } catch (error) {
    console.error('❌ Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

// GET /posts/:id/comments - Fetch all comments for a post
router.get('/posts/:id/comments', auth, async (req, res) => {
  try {
    console.log(`🔥 GET /api/comments/posts/${req.params.id}/comments`);
    const postId = req.params.id;
    const user = req.user;
    const { sort = 'newest' } = req.query;

    // Check if post exists and user has access
    const accessCheck = await checkStateAccess(postId, user.state);
    if (!accessCheck.allowed) {
      return res.status(403).json({ error: accessCheck.error });
    }

    // Determine sort order
    let sortQuery = {};
    switch (sort) {
      case 'newest':
        sortQuery = { createdAt: -1 };
        break;
      case 'oldest':
        sortQuery = { createdAt: 1 };
        break;
      case 'most_voted':
        sortQuery = { votes: -1, createdAt: -1 };
        break;
      default:
        sortQuery = { createdAt: -1 };
    }

    // Fetch comments
    const comments = await Comment.find({
      postId,
      isActive: true,
      parentCommentId: null // Only top-level comments for now
    })
    .sort(sortQuery)
    .limit(100) // Reasonable limit
    .lean();

    console.log(`📖 Found ${comments.length} comments for post`);

    // Format comments for frontend
    const formattedComments = comments.map(comment => ({
      _id: comment._id,
      content: comment.content,
      authorUsername: comment.authorUsername,
      authorState: comment.authorState,
      createdAt: comment.createdAt,
      timeAgo: getTimeAgo(comment.createdAt),
      votes: comment.votes,
      edited: comment.edited
    }));

    res.json({
      success: true,
      comments: formattedComments,
      total: formattedComments.length
    });

  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Helper function for time formatting (since we're using lean queries)
function getTimeAgo(createdAt) {
  const now = new Date();
  const diff = now - createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

module.exports = router;