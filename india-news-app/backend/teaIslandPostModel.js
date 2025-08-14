const mongoose = require('mongoose');

const teaIslandPostSchema = new mongoose.Schema({
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
  tab: {
    type: String,
    required: true,
    enum: ['tea', 'island', 'general'] // Based on user's gender or general forum
  },
  category: {
    type: String,
    required: true,
    enum: ['discussion', 'question', 'hot', 'news'] // Added 'news' for general forums
  },
  subcategory: {
    type: String,
    required: function() {
      // Subcategory is required for tea/island, optional for general
      return this.tab === 'tea' || this.tab === 'island';
    },
    // Tea subcategories: girl-talk, k-fanatic, hot-topics, glow-up
    // Island subcategories: brotherhood, anime, gym-rat, hustle
    // General subcategories: local-news, community, help, events
    enum: [
      // Tea subcategories
      'girl-talk', 'k-fanatic', 'hot-topics', 'glow-up',
      // Island subcategories
      'brotherhood', 'anime', 'gym-rat', 'hustle',
      // General forum subcategories
      'local-news', 'community', 'help', 'events'
    ]
  },
  state: {
    type: String,
    required: true,
    enum: [
      'Assam', 'Meghalaya', 'Manipur', 'Mizoram', 'Nagaland', 
      'Arunachal Pradesh', 'Tripura', 'Sikkim',
      'Gujarat', 'Maharashtra'
    ]
  },
  votes: {
    up: {
      type: Number,
      default: 0
    },
    down: {
      type: Number,
      default: 0
    },
    users: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      vote: {
        type: String,
        enum: ['up', 'down']
      }
    }]
  },
  reactions: {
    type: Number,
    default: 0
  },
  reactionUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  replies: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  isHot: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
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
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
teaIslandPostSchema.index({ tab: 1, category: 1, createdAt: -1 });
teaIslandPostSchema.index({ tab: 1, subcategory: 1, createdAt: -1 });
teaIslandPostSchema.index({ tab: 1, state: 1, createdAt: -1 });
teaIslandPostSchema.index({ author: 1, createdAt: -1 });
teaIslandPostSchema.index({ isHot: 1, createdAt: -1 });
teaIslandPostSchema.index({ isPinned: 1, createdAt: -1 });

// Update lastActivity on save
teaIslandPostSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.isModified() && !this.isNew) {
    this.lastActivity = Date.now();
  }
  next();
});

// Virtual for calculating engagement score
teaIslandPostSchema.virtual('engagementScore').get(function() {
  return (this.votes.up * 2) + this.reactions + (this.replies * 3) + (this.views * 0.1);
});

// Method to check if user has voted
teaIslandPostSchema.methods.getUserVote = function(userId) {
  const userVote = this.votes.users.find(vote => vote.userId.toString() === userId.toString());
  return userVote ? userVote.vote : null;
};

// Method to check if user has reacted
teaIslandPostSchema.methods.hasUserReacted = function(userId) {
  return this.reactionUsers.includes(userId);
};

// Static method to get trending posts
teaIslandPostSchema.statics.getTrending = function(tab, limit = 10) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return this.aggregate([
    {
      $match: {
        tab: tab,
        isActive: true,
        createdAt: { $gte: oneDayAgo }
      }
    },
    {
      $addFields: {
        engagementScore: {
          $add: [
            { $multiply: ['$votes.up', 2] },
            '$reactions',
            { $multiply: ['$replies', 3] },
            { $multiply: ['$views', 0.1] }
          ]
        }
      }
    },
    {
      $sort: { engagementScore: -1, createdAt: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

module.exports = mongoose.model('TeaIslandPost', teaIslandPostSchema);