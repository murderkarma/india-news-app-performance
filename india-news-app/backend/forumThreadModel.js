const mongoose = require('mongoose');

const forumThreadSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  authorUsername: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['hot-topics', 'glow-up', 'girl-talk', 'k-fanatic']
  },
  isSticky: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  replies: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    authorUsername: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: 2000
    },
    // Legacy likes array (keeping for backward compatibility)
    likes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    // New voting system with upvotes/downvotes
    votes: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      type: {
        type: String,
        enum: ['upvote', 'downvote'],
        required: true
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    // Computed vote scores for performance
    upvotes: {
      type: Number,
      default: 0
    },
    downvotes: {
      type: Number,
      default: 0
    },
    score: {
      type: Number,
      default: 0
    },
    // Engagement score for sorting (score + time decay)
    engagementScore: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  views: {
    type: Number,
    default: 0
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  // Moderation fields
  isRemoved: {
    type: Boolean,
    default: false
  },
  removedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  removedAt: {
    type: Date,
    default: null
  },
  removalReason: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Update lastActivity when replies are added
forumThreadSchema.pre('save', function(next) {
  if (this.isModified('replies')) {
    this.lastActivity = new Date();
    
    // Update engagement scores for all replies
    this.replies.forEach(reply => {
      reply.engagementScore = this.calculateEngagementScore(reply);
    });
  }
  next();
});

// Static method to calculate engagement score (Reddit-like algorithm)
forumThreadSchema.methods.calculateEngagementScore = function(reply) {
  const score = reply.upvotes - reply.downvotes;
  const ageInHours = (Date.now() - reply.createdAt.getTime()) / (1000 * 60 * 60);
  
  // Time decay factor - newer comments get higher scores
  const timeDecay = Math.pow(ageInHours + 2, -1.5);
  
  return score * timeDecay;
};

// Static method to vote on a reply
forumThreadSchema.methods.voteOnReply = function(replyId, userId, voteType) {
  const reply = this.replies.id(replyId);
  if (!reply) {
    throw new Error('Reply not found');
  }

  // Remove existing vote from this user
  reply.votes = reply.votes.filter(vote => vote.user.toString() !== userId.toString());

  // Add new vote if it's not removing a vote
  if (voteType === 'upvote' || voteType === 'downvote') {
    reply.votes.push({
      user: userId,
      type: voteType
    });
  }

  // Recalculate vote counts
  reply.upvotes = reply.votes.filter(vote => vote.type === 'upvote').length;
  reply.downvotes = reply.votes.filter(vote => vote.type === 'downvote').length;
  reply.score = reply.upvotes - reply.downvotes;
  reply.engagementScore = this.calculateEngagementScore(reply);

  return {
    upvotes: reply.upvotes,
    downvotes: reply.downvotes,
    score: reply.score,
    userVote: voteType || null
  };
};

// Static method to get sorted replies
forumThreadSchema.methods.getSortedReplies = function(sortBy = 'recent') {
  let sortedReplies = [...this.replies];

  switch (sortBy) {
    case 'top':
      // Sort by score (upvotes - downvotes), then by engagement score
      sortedReplies.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.engagementScore - a.engagementScore;
      });
      break;
    case 'hot':
      // Sort by engagement score (considers both votes and time)
      sortedReplies.sort((a, b) => b.engagementScore - a.engagementScore);
      break;
    case 'recent':
    default:
      // Sort by creation time (newest first)
      sortedReplies.sort((a, b) => b.createdAt - a.createdAt);
      break;
  }

  return sortedReplies;
};

// Virtual for reply count
forumThreadSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Virtual for like count
forumThreadSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Ensure virtuals are included in JSON output
forumThreadSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('ForumThread', forumThreadSchema);