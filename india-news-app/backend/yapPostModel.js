const mongoose = require('mongoose');

// Define the reaction types as constants for consistency
const REACTION_TYPES = ['heart', 'laugh', 'meh', 'skeptical', 'fire', 'handshake'];

const yapPostSchema = new mongoose.Schema({
  // User who created the post
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Post content
  title: {
    type: String,
    maxlength: 160,
    trim: true,
    default: null
  },
  
  body: {
    type: String,
    required: true,
    minlength: 1,
    maxlength: 8000,
    trim: true
  },
  
  // Optional images (max 6)
  images: {
    type: [String],
    validate: {
      validator: function(images) {
        return images.length <= 6;
      },
      message: 'Maximum 6 images allowed per post'
    },
    default: []
  },
  
  // Optional topic/category
  topic: {
    type: String,
    trim: true,
    maxlength: 50,
    default: null
  },
  
  // Optional state (for regional filtering)
  state: {
    type: String,
    enum: [
      'Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 
      'Arunachal Pradesh', 'Tripura', 'Sikkim',
      'Gujarat', 'Maharashtra', null
    ],
    default: null
  },
  
  // Reactions array - no _id, with timestamps
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
    }
  }],
  
  // Comments array with timestamps
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
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metrics for sorting and engagement
  metrics: {
    views: {
      type: Number,
      default: 0
    },
    score: {
      type: Number,
      default: 0
    }
  },
  
  // Moderation fields (following existing pattern)
  isActive: {
    type: Boolean,
    default: true
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
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Indexes for performance (as specified)
yapPostSchema.index({ createdAt: -1 });
yapPostSchema.index({ 'metrics.score': -1, createdAt: -1 });
yapPostSchema.index({ userId: 1, createdAt: -1 });
yapPostSchema.index({ topic: 1, createdAt: -1 });
yapPostSchema.index({ state: 1, createdAt: -1 });
yapPostSchema.index({ isActive: 1, createdAt: -1 });

// Pre-save middleware to update metrics.score
yapPostSchema.pre('save', function(next) {
  // Calculate engagement score based on reactions and comments
  const reactionScore = this.reactions.length * 2; // Each reaction worth 2 points
  const commentScore = this.comments.length * 5; // Each comment worth 5 points
  const viewScore = this.metrics.views * 0.1; // Views worth 0.1 points each
  
  // Time decay factor (newer posts get slight boost)
  const ageInHours = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  const timeDecay = Math.max(0.1, 1 - (ageInHours / 168)); // Decay over 1 week
  
  this.metrics.score = Math.round((reactionScore + commentScore + viewScore) * timeDecay);
  
  next();
});

// Instance method to get reaction counts by type
yapPostSchema.methods.getReactionCounts = function() {
  const counts = {};
  REACTION_TYPES.forEach(type => {
    counts[type] = this.reactions.filter(r => r.type === type).length;
  });
  return counts;
};

// Instance method to check if user has reacted with specific type
yapPostSchema.methods.getUserReaction = function(userId) {
  const reaction = this.reactions.find(r => r.userId.toString() === userId.toString());
  return reaction ? reaction.type : null;
};

// Instance method to add or update user reaction
yapPostSchema.methods.updateReaction = function(userId, reactionType) {
  // Remove any existing reaction from this user
  this.reactions = this.reactions.filter(r => r.userId.toString() !== userId.toString());
  
  // Add new reaction
  this.reactions.push({
    userId: userId,
    type: reactionType
  });
  
  return this.save();
};

// Instance method to remove user reaction
yapPostSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.userId.toString() !== userId.toString());
  return this.save();
};

// Static method for trending posts (similar to existing patterns)
yapPostSchema.statics.getTrending = function(limit = 20) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        isActive: true,
        createdAt: { $gte: oneDayAgo }
      }
    },
    {
      $addFields: {
        trendingScore: {
          $add: [
            { $multiply: [{ $size: '$reactions' }, 3] },
            { $multiply: [{ $size: '$comments' }, 5] },
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

// Virtual for total engagement
yapPostSchema.virtual('totalEngagement').get(function() {
  return this.reactions.length + this.comments.length + Math.floor(this.metrics.views / 10);
});

// Ensure virtuals are included in JSON output
yapPostSchema.set('toJSON', { virtuals: true });

const YapPost = mongoose.model('YapPost', yapPostSchema);

module.exports = {
  YapPost,
  REACTION_TYPES
};