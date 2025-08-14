const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  // What is being reported
  reportType: {
    type: String,
    required: true,
    enum: ['post', 'comment', 'thread', 'thread_reply', 'user']
  },
  
  // References to reported content
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeaIslandPost',
    default: null
  },
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  threadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread',
    default: null
  },
  threadReplyId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null // For specific thread replies
  },
  reportedUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Who reported it
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reporterUsername: {
    type: String,
    required: true
  },
  reporterState: {
    type: String,
    required: true
  },
  
  // Report details
  reason: {
    type: String,
    required: true,
    enum: [
      'spam',
      'harassment',
      'hate_speech',
      'inappropriate_content',
      'misinformation',
      'violence',
      'sexual_content',
      'copyright',
      'doxxing',
      'other'
    ]
  },
  description: {
    type: String,
    maxlength: 500,
    trim: true
  },
  
  // Moderation status
  status: {
    type: String,
    enum: ['pending', 'reviewing', 'resolved', 'dismissed'],
    default: 'pending'
  },
  
  // Admin actions
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  adminNotes: {
    type: String,
    maxlength: 1000,
    default: ''
  },
  actionTaken: {
    type: String,
    enum: ['none', 'content_removed', 'user_warned', 'user_suspended', 'user_banned'],
    default: 'none'
  },
  
  // Severity and priority
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  priority: {
    type: Number,
    default: 1, // 1-5 scale
    min: 1,
    max: 5
  },
  
  // Metadata
  reportCount: {
    type: Number,
    default: 1 // How many times this content has been reported
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient queries
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reportType: 1, status: 1 });
reportSchema.index({ reportedBy: 1, createdAt: -1 });
reportSchema.index({ severity: 1, priority: -1, createdAt: -1 });
reportSchema.index({ postId: 1, status: 1 });
reportSchema.index({ threadId: 1, status: 1 });

// Update timestamp on save
reportSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to create a report
reportSchema.statics.createReport = async function(reportData) {
  const {
    reportType,
    postId,
    commentId,
    threadId,
    threadReplyId,
    reportedUserId,
    reportedBy,
    reporterUsername,
    reporterState,
    reason,
    description
  } = reportData;

  // Check for duplicate reports from same user for same content
  const existingReport = await this.findOne({
    reportedBy,
    reportType,
    postId,
    commentId,
    threadId,
    threadReplyId,
    reportedUserId,
    status: { $in: ['pending', 'reviewing'] }
  });

  if (existingReport) {
    console.log('🔕 Duplicate report prevented');
    return existingReport;
  }

  // Check if this content has been reported before by others
  const contentQuery = { reportType };
  if (postId) contentQuery.postId = postId;
  if (commentId) contentQuery.commentId = commentId;
  if (threadId) contentQuery.threadId = threadId;
  if (threadReplyId) contentQuery.threadReplyId = threadReplyId;
  if (reportedUserId) contentQuery.reportedUserId = reportedUserId;

  const existingReports = await this.find(contentQuery);
  const reportCount = existingReports.length + 1;

  // Auto-escalate severity based on report count
  let severity = 'medium';
  let priority = 1;

  if (reportCount >= 5) {
    severity = 'critical';
    priority = 5;
  } else if (reportCount >= 3) {
    severity = 'high';
    priority = 4;
  } else if (reportCount >= 2) {
    severity = 'medium';
    priority = 3;
  }

  // Auto-escalate for certain reasons
  if (['hate_speech', 'violence', 'doxxing'].includes(reason)) {
    severity = 'high';
    priority = Math.max(priority, 4);
  }

  const report = new this({
    reportType,
    postId,
    commentId,
    threadId,
    threadReplyId,
    reportedUserId,
    reportedBy,
    reporterUsername,
    reporterState,
    reason,
    description,
    severity,
    priority,
    reportCount
  });

  await report.save();
  console.log(`🚨 Report created: ${reportType} - ${reason} (Severity: ${severity})`);
  return report;
};

// Static method to get reports with filtering and pagination
reportSchema.statics.getReports = async function(filters = {}, options = {}) {
  const {
    status = null,
    reportType = null,
    severity = null,
    reason = null,
    page = 1,
    limit = 20,
    sortBy = 'priority'
  } = { ...filters, ...options };

  const query = {};
  if (status) query.status = status;
  if (reportType) query.reportType = reportType;
  if (severity) query.severity = severity;
  if (reason) query.reason = reason;

  let sortOptions = {};
  switch (sortBy) {
    case 'priority':
      sortOptions = { priority: -1, createdAt: -1 };
      break;
    case 'recent':
      sortOptions = { createdAt: -1 };
      break;
    case 'severity':
      sortOptions = { severity: -1, priority: -1, createdAt: -1 };
      break;
    default:
      sortOptions = { createdAt: -1 };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const reports = await this.find(query)
    .populate('reportedBy', 'username state')
    .populate('reviewedBy', 'username')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();

  const total = await this.countDocuments(query);

  return {
    reports,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
      hasMore: reports.length === parseInt(limit)
    }
  };
};

// Static method to get report statistics
reportSchema.statics.getReportStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        pendingReports: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        reviewingReports: {
          $sum: { $cond: [{ $eq: ['$status', 'reviewing'] }, 1, 0] }
        },
        resolvedReports: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        dismissedReports: {
          $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] }
        },
        criticalReports: {
          $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] }
        },
        highPriorityReports: {
          $sum: { $cond: [{ $gte: ['$priority', 4] }, 1, 0] }
        }
      }
    }
  ]);

  return stats[0] || {
    totalReports: 0,
    pendingReports: 0,
    reviewingReports: 0,
    resolvedReports: 0,
    dismissedReports: 0,
    criticalReports: 0,
    highPriorityReports: 0
  };
};

module.exports = mongoose.model('Report', reportSchema);