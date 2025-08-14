const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeaIslandPost',
    required: true
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  edited: {
    type: Boolean,
    default: false
  },
  votes: {
    type: Number,
    default: 0
  },
  // Future threading support
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  // Future reactions support
  reactions: {
    type: Map,
    of: Number,
    default: new Map()
  },
  // Denormalized fields for performance
  authorUsername: {
    type: String,
    required: true
  },
  authorState: {
    type: String,
    required: true
  },
  postTab: {
    type: String,
    enum: ['tea', 'island', 'general'],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
});

// Indexes for efficient queries
commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, votes: -1 });
commentSchema.index({ authorId: 1 });
commentSchema.index({ postTab: 1, authorState: 1 });

// Virtual for time formatting
commentSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
});

// Ensure virtual fields are serialized
commentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Comment', commentSchema);