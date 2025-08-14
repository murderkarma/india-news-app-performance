const mongoose = require('mongoose');

// Define the reaction types as constants for consistency across all spaces
const REACTION_TYPES = ['heart', 'laugh', 'meh', 'skeptical', 'fire', 'handshake'];

// Define space-specific configurations
const SPACE_CONFIG = {
  yap: {
    topics: ['mental-health', 'humor', 'food', 'relationships', 'work', 'life', 'random'],
    allowTitle: true,
    maxBodyLength: 8000,
    requiresState: false
  },
  tea: {
    categories: ['girl-talk', 'k-fanatic', 'hot-topics', 'glow-up'],
    allowTitle: true,
    maxBodyLength: 5000,
    requiresState: false,
    genderRequired: 'female'
  },
  brospace: {
    categories: ['brotherhood', 'anime', 'gym-rat', 'hustle'],
    allowTitle: true,
    maxBodyLength: 5000,
    requiresState: false,
    genderRequired: 'male'
  },
  local: {
    categories: ['news', 'events', 'discussion', 'community'],
    allowTitle: true,
    maxBodyLength: 3000,
    requiresState: true,
    stateRestricted: true
  }
};

const postSchema = new mongoose.Schema({
  // Space identifier - the key field for multi-tab support
  space: {
    type: String,
    enum: ['yap', 'tea', 'brospace', 'local'],
    required: true,
    index: true
  },
  
  // User who created the post
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Post content
  title: {
    type: String,
    maxlength: 200, // Increased for Tea/Brospace compatibility
    trim: true,
    default: null
  },
  
  body: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 8000, // Will be validated per-space in routes
    trim: true
  },
  
  // Optional images (max 6, validated with HTTP/HTTPS only)
  images: {
    type: [String],
    validate: {
      validator: function(images) {
        if (images.length > 6) return false;
        return images.every(url => /^https?:\/\//.test(url));
      },
      message: 'Maximum 6 images allowed, must be HTTP/HTTPS URLs'
    },
    default: []
  },
  
  // Topic for YAP, Category for Tea/Brospace/Local
  topic: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null,
    index: true
  },
  
  // Subcategory for more granular classification
  subcategory: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null
  },
  
  // State for regional filtering and local posting restrictions
  state: {
    type: String,
    enum: [
      'Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 
      'Arunachal Pradesh', 'Tripura', 'Sikkim',
      'Gujarat', 'Maharashtra', null
    ],
    default: null,
    index: true
  },
  
  // Enhanced reactions system (6-type with user tracking)
  reactions: [{
    _id: false,
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: REACTION_TYPES,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Comments with enhanced features
  comments: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    body: {
      type: String,
      required: true,
      minlength: 1,
      maxlength: 4000,
      trim: true
    },
    featured: {
      type: Boolean,
      default: false
    },
    isRemoved: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Enhanced metrics for engagement tracking
  metrics: {
    views: {
      type: Number,
      default: 0,
      index: true
    },
    score: {
      type: Number,
      default: 0,
      index: true
    },
    engagementRate: {
      type: Number,
      default: 0
    }
  },
  
  // Moderation and status fields
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  isHot: {
    type: Boolean,
    default: false,
    index: true
  },
  
  isPinned: {
    type: Boolean,
    default: false,
    index: true
  },
  
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
  
  // Activity tracking
  lastActivity: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Compound indexes for optimal query performance
postSchema.index({ space: 1, createdAt: -1 });
postSchema.index({ space: 1, 'metrics.score': -1, createdAt: -1 });
postSchema.index({ space: 1, topic: 1, createdAt: -1 });
postSchema.index({ space: 1, state: 1, createdAt: -1 });
postSchema.index({ space: 1, isActive: 1, createdAt: -1 });
postSchema.index({ space: 1, isHot: 1, createdAt: -1 });
postSchema.index({ space: 1, isPinned: 1, createdAt: -1 });
postSchema.index({ userId: 1, space: 1, createdAt: -1 });

// Pre-save middleware to update metrics and activity
postSchema.pre('save', function(next) {
  // Update last activity on any modification
  if (this.isModified() && !this.isNew) {
    this.lastActivity = new Date();
  }
  
  // Calculate engagement score based on reactions, comments, and views
  const reactionScore = this.reactions.length * 2;
  const commentScore = this.comments.filter(c => !c.isRemoved).length * 5;
  const viewScore = this.metrics.views * 0.1;
  
  // Time decay factor (newer posts get slight boost)
  const ageInHours = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  const timeDecay = Math.max(0.1, 1 - (ageInHours / 168)); // Decay over 1 week
  
  // Space-specific scoring multipliers
  const spaceMultiplier = {
    yap: 1.0,
    tea: 1.1,     // Slightly boost tea engagement
    brospace: 1.1, // Slightly boost brospace engagement  
    local: 0.8    // Local posts compete less globally
  };
  
  const multiplier = spaceMultiplier[this.space] || 1.0;
  this.metrics.score = Math.round((reactionScore + commentScore + viewScore) * timeDecay * multiplier);
  
  // Calculate engagement rate
  if (this.metrics.views > 0) {
    this.metrics.engagementRate = ((this.reactions.length + this.comments.length) / this.metrics.views) * 100;
  }
  
  // Auto-mark as hot if high engagement
  const totalEngagement = this.reactions.length + this.comments.length;
  this.isHot = totalEngagement >= 10 || this.metrics.score >= 50;
  
  next();
});

// Instance method to get reaction counts by type
postSchema.methods.getReactionCounts = function() {
  const counts = {};
  REACTION_TYPES.forEach(type => {
    counts[type] = this.reactions.filter(r => r.type === type).length;
  });
  return counts;
};

// Instance method to check if user has reacted with specific type
postSchema.methods.getUserReaction = function(userId) {
  const reaction = this.reactions.find(r => r.userId.toString() === userId.toString());
  return reaction ? reaction.type : null;
};

// Instance method to add or update user reaction (idempotent)
postSchema.methods.updateReaction = function(userId, reactionType) {
  // Remove any existing reaction from this user
  this.reactions = this.reactions.filter(r => r.userId.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({
    userId: userId,
    type: reactionType,
    createdAt: new Date()
  });
  
  return this.save();
};

// Instance method to remove user reaction
postSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.userId.toString() !== userId.toString());
  return this.save();
};

// Instance method to add comment
postSchema.methods.addComment = function(userId, body, featured = false) {
  this.comments.push({
    userId: userId,
    body: body,
    featured: featured,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  return this.save();
};

// Static method for space-specific trending posts
postSchema.statics.getTrending = function(space, limit = 20) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        space: space,
        isActive: true,
        createdAt: { $gte: oneDayAgo }
      }
    },
    {
      $addFields: {
        trendingScore: {
          $add: [
            { $multiply: [{ $size: '$reactions' }, 3] },
            { $multiply: [{ $size: { $filter: { input: '$comments', cond: { $eq: ['$$this.isRemoved', false] } } } }, 5] },
            { $multiply: ['$metrics.views', 0.2] }
          ]
        }
      }
    },
    {
      $sort: { trendingScore: -1, createdAt: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method for space-specific hot posts
postSchema.statics.getHot = function(space, limit = 20) {
  return this.find({
    space: space,
    isActive: true,
    isHot: true
  })
  .sort({ 'metrics.score': -1, createdAt: -1 })
  .limit(limit)
  .populate('userId', 'username karma state gender');
};

// Static method to get space configuration
postSchema.statics.getSpaceConfig = function(space) {
  return SPACE_CONFIG[space] || null;
};

// Virtual for total engagement
postSchema.virtual('totalEngagement').get(function() {
  const activeComments = this.comments.filter(c => !c.isRemoved).length;
  return this.reactions.length + activeComments + Math.floor(this.metrics.views / 10);
});

// Virtual for engagement summary
postSchema.virtual('engagementSummary').get(function() {
  return {
    reactions: this.reactions.length,
    comments: this.comments.filter(c => !c.isRemoved).length,
    views: this.metrics.views,
    score: this.metrics.score,
    isHot: this.isHot
  };
});

// Ensure virtuals are included in JSON output
postSchema.set('toJSON', { virtuals: true });

const Post = mongoose.model('Post', postSchema);

module.exports = {
  Post,
  REACTION_TYPES,
  SPACE_CONFIG
};