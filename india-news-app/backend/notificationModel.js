const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'comment_reply',      // Someone replied to your comment
      'post_comment',       // Someone commented on your post
      'post_like',          // Someone liked your post
      'post_reaction',      // Someone reacted to your post
      'thread_reply',       // Someone replied to your forum thread
      'thread_like',        // Someone liked your forum thread
      'mention'             // Someone mentioned you (future feature)
    ]
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 300
  },
  // Reference to the related content
  relatedPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TeaIslandPost',
    default: null
  },
  relatedThread: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ForumThread',
    default: null
  },
  relatedComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  // Metadata for navigation
  actionUrl: {
    type: String,
    required: true // URL to navigate to when notification is clicked
  },
  // Status tracking
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  // Denormalized data for performance
  senderUsername: {
    type: String,
    required: true
  },
  senderState: {
    type: String,
    required: true
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  }
});

// Compound indexes for efficient queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isDeleted: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });

// Virtual for time formatting
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return this.createdAt.toLocaleDateString();
});

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const {
    recipient,
    sender,
    type,
    title,
    message,
    actionUrl,
    relatedPost = null,
    relatedThread = null,
    relatedComment = null,
    senderUsername,
    senderState
  } = data;

  // Don't create notification if sender is the same as recipient
  if (recipient.toString() === sender.toString()) {
    return null;
  }

  // Check for duplicate notifications (prevent spam)
  const recentDuplicate = await this.findOne({
    recipient,
    sender,
    type,
    relatedPost,
    relatedThread,
    relatedComment,
    createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
  });

  if (recentDuplicate) {
    console.log('🔕 Duplicate notification prevented');
    return recentDuplicate;
  }

  const notification = new this({
    recipient,
    sender,
    type,
    title,
    message,
    actionUrl,
    relatedPost,
    relatedThread,
    relatedComment,
    senderUsername,
    senderState
  });

  await notification.save();
  console.log(`🔔 Notification created: ${type} for user ${recipient}`);
  return notification;
};

// Static method to mark notifications as read
notificationSchema.statics.markAsRead = async function(notificationIds, userId) {
  const result = await this.updateMany(
    {
      _id: { $in: notificationIds },
      recipient: userId,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );

  return result.modifiedCount;
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = async function(userId) {
  return await this.countDocuments({
    recipient: userId,
    isRead: false,
    isDeleted: false
  });
};

// Ensure virtual fields are serialized
notificationSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);