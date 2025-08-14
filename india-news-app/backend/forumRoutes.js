const express = require('express');
const router = express.Router();
const ForumThread = require('./forumThreadModel');
const Notification = require('./notificationModel');
const auth = require('./middleware/auth');

// Get forum threads by category
router.get('/threads/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { page = 1, limit = 25 } = req.query;
    
    console.log(`🧵 GET /api/forum/threads/${category}`);
    console.log(`📄 Page: ${page}, Limit: ${limit}`);

    let query = {};
    if (category !== 'all') {
      query.category = category;
    }

    const threads = await ForumThread.find(query)
      .populate('author', 'username')
      .sort({ isSticky: -1, lastActivity: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    // Format threads for frontend
    const formattedThreads = threads.map(thread => ({
      id: thread._id,
      title: thread.title,
      author: thread.authorUsername,
      category: thread.category,
      timestamp: formatTimestamp(thread.createdAt),
      replies: thread.replies.length,
      likes: thread.likes.length,
      isSticky: thread.isSticky,
      lastActivity: formatTimestamp(thread.lastActivity),
      views: thread.views
    }));

    res.json({
      threads: formattedThreads,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(await ForumThread.countDocuments(query) / limit),
        hasMore: formattedThreads.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching forum threads:', error);
    res.status(500).json({ error: 'Failed to fetch forum threads' });
  }
});

// Get single thread with replies
router.get('/thread/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { sort = 'recent' } = req.query; // Default to recent sorting
    const userId = req.user ? (req.user._id || req.user.userId) : null;
    
    console.log(`🧵 GET /api/forum/thread/${id} (sort: ${sort})`);

    const thread = await ForumThread.findById(id)
      .populate('author', 'username')
      .populate('replies.author', 'username');

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Increment view count
    thread.views += 1;
    await thread.save();

    // Get sorted replies
    const sortedReplies = thread.getSortedReplies(sort);

    res.json({
      id: thread._id,
      title: thread.title,
      content: thread.content,
      author: thread.authorUsername,
      category: thread.category,
      timestamp: formatTimestamp(thread.createdAt),
      likes: thread.likes.length,
      isSticky: thread.isSticky,
      isLocked: thread.isLocked,
      views: thread.views,
      replies: sortedReplies.map(reply => {
        // Find user's vote on this reply
        const userVote = userId ? reply.votes.find(vote => vote.user.toString() === userId.toString()) : null;
        
        return {
          id: reply._id,
          content: reply.content,
          author: reply.authorUsername,
          timestamp: formatTimestamp(reply.createdAt),
          likes: reply.likes.length, // Legacy likes count
          upvotes: reply.upvotes || 0,
          downvotes: reply.downvotes || 0,
          score: reply.score || 0,
          engagementScore: reply.engagementScore || 0,
          userVote: userVote ? userVote.type : null
        };
      })
    });

  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread' });
  }
});

// Create new thread
router.post('/threads', auth, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    console.log(`🧵 POST /api/forum/threads`);
    console.log(`👤 User: ${username}, Category: ${category}`);

    if (!title || !content || !category) {
      return res.status(400).json({ error: 'Title, content, and category are required' });
    }

    const validCategories = ['hot-topics', 'glow-up', 'girl-talk', 'k-fanatic'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const thread = new ForumThread({
      title,
      content,
      author: userId,
      authorUsername: username,
      category
    });

    await thread.save();

    res.status(201).json({
      message: 'Thread created successfully',
      thread: {
        id: thread._id,
        title: thread.title,
        author: thread.authorUsername,
        category: thread.category,
        timestamp: formatTimestamp(thread.createdAt),
        replies: 0,
        likes: 0,
        isSticky: false,
        lastActivity: formatTimestamp(thread.lastActivity)
      }
    });

  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread' });
  }
});

// Add reply to thread
router.post('/thread/:id/reply', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    console.log(`💬 POST /api/forum/thread/${id}/reply`);
    console.log(`👤 User: ${username}`);

    if (!content) {
      return res.status(400).json({ error: 'Reply content is required' });
    }

    const thread = await ForumThread.findById(id);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.isLocked) {
      return res.status(403).json({ error: 'Thread is locked' });
    }

    thread.replies.push({
      author: userId,
      authorUsername: username,
      content,
      votes: [],
      upvotes: 0,
      downvotes: 0,
      score: 0,
      engagementScore: 0
    });

    await thread.save();

    // Create notification for thread author (if not replying to own thread)
    try {
      if (thread.author.toString() !== userId.toString()) {
        await Notification.createNotification({
          recipient: thread.author,
          sender: userId,
          type: 'thread_reply',
          title: 'New Reply',
          message: `${username} replied to your thread: "${thread.title.substring(0, 50)}${thread.title.length > 50 ? '...' : ''}"`,
          actionUrl: `/forum/thread/${thread._id}`,
          relatedThread: thread._id,
          senderUsername: username,
          senderState: req.user.state
        });
        console.log(`🔔 Notification sent to thread author for new reply`);
      }
    } catch (notificationError) {
      console.error('❌ Failed to create thread reply notification:', notificationError);
      // Don't fail the reply if notification fails
    }

    res.status(201).json({
      message: 'Reply added successfully',
      reply: {
        id: thread.replies[thread.replies.length - 1]._id,
        content,
        author: username,
        timestamp: formatTimestamp(new Date()),
        likes: 0
      }
    });

  } catch (error) {
    console.error('Error adding reply:', error);
    res.status(500).json({ error: 'Failed to add reply' });
  }
});

// Like/unlike thread
router.post('/thread/:id/like', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    console.log(`❤️ POST /api/forum/thread/${id}/like`);
    console.log(`👤 User: ${userId}`);

    const thread = await ForumThread.findById(id);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const existingLike = thread.likes.find(like => like.user.toString() === userId);

    if (existingLike) {
      // Unlike
      thread.likes = thread.likes.filter(like => like.user.toString() !== userId);
    } else {
      // Like
      thread.likes.push({ user: userId });
    }

    await thread.save();

    // Create notification for thread author (only when liking, not unliking)
    try {
      if (!existingLike && thread.author.toString() !== userId.toString()) {
        await Notification.createNotification({
          recipient: thread.author,
          sender: userId,
          type: 'thread_like',
          title: 'Thread Liked',
          message: `${req.user.username} liked your thread: "${thread.title.substring(0, 50)}${thread.title.length > 50 ? '...' : ''}"`,
          actionUrl: `/forum/thread/${thread._id}`,
          relatedThread: thread._id,
          senderUsername: req.user.username,
          senderState: req.user.state
        });
        console.log(`🔔 Notification sent to thread author for like`);
      }
    } catch (notificationError) {
      console.error('❌ Failed to create thread like notification:', notificationError);
      // Don't fail the like if notification fails
    }

    res.json({
      message: existingLike ? 'Thread unliked' : 'Thread liked',
      likes: thread.likes.length,
      isLiked: !existingLike
    });

  } catch (error) {
    console.error('Error toggling thread like:', error);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Vote on thread reply (upvote/downvote)
router.post('/thread/:threadId/comment/:commentId/vote', auth, async (req, res) => {
  try {
    const { threadId, commentId } = req.params;
    const { voteType } = req.body; // 'upvote', 'downvote', or null to remove vote
    const userId = req.user._id || req.user.userId;

    console.log(`🗳️ POST /api/forum/thread/${threadId}/comment/${commentId}/vote`);
    console.log(`👤 User: ${req.user.username}, Vote: ${voteType}`);

    // Validate vote type
    if (voteType && !['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type. Must be "upvote", "downvote", or null' });
    }

    const thread = await ForumThread.findById(threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    if (thread.isLocked) {
      return res.status(403).json({ error: 'Thread is locked' });
    }

    try {
      const voteResult = thread.voteOnReply(commentId, userId, voteType);
      await thread.save();

      // Create notification for comment author (only for upvotes, not downvotes or vote removal)
      try {
        const reply = thread.replies.id(commentId);
        if (voteType === 'upvote' && reply.author.toString() !== userId.toString()) {
          await Notification.createNotification({
            recipient: reply.author,
            sender: userId,
            type: 'comment_reply', // Using existing type, could add 'comment_vote' later
            title: 'Comment Upvoted',
            message: `${req.user.username} upvoted your comment in "${thread.title.substring(0, 50)}${thread.title.length > 50 ? '...' : ''}"`,
            actionUrl: `/forum/thread/${thread._id}#comment-${commentId}`,
            relatedThread: thread._id,
            relatedComment: commentId,
            senderUsername: req.user.username,
            senderState: req.user.state
          });
          console.log(`🔔 Notification sent to comment author for upvote`);
        }
      } catch (notificationError) {
        console.error('❌ Failed to create vote notification:', notificationError);
        // Don't fail the vote if notification fails
      }

      res.json({
        message: voteType ? `Comment ${voteType}d successfully` : 'Vote removed successfully',
        vote: voteResult
      });

    } catch (voteError) {
      if (voteError.message === 'Reply not found') {
        return res.status(404).json({ error: 'Comment not found' });
      }
      throw voteError;
    }

  } catch (error) {
    console.error('Error voting on comment:', error);
    res.status(500).json({ error: 'Failed to vote on comment' });
  }
});

// Helper function to format timestamps
function formatTimestamp(date) {
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}

module.exports = router;