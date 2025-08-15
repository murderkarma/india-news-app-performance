/**
 * Notification Trigger Service
 * Handles automatic push notification triggers for various events
 */

const pushNotificationService = require('./pushNotificationService');
const Notification = require('../notificationModel');
const User = require('../userModel');
// Use a simple console logger to avoid pino transport conflicts
const logger = {
  info: (data, msg) => console.log(`[INFO] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  error: (data, msg) => console.error(`[ERROR] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  warn: (data, msg) => console.warn(`[WARN] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  debug: (data, msg) => console.log(`[DEBUG] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
};
const analyticsService = require('./analyticsService');

class NotificationTriggerService {
  constructor() {
    this.isEnabled = process.env.NOTIFICATIONS_ENABLED !== 'false';
    this.testMode = process.env.TEST_MODE === 'true';
    logger.info('🔔 Notification Trigger Service initialized', {
      enabled: this.isEnabled,
      testMode: this.testMode
    });
  }

  /**
   * Trigger notification when someone comments on a user's post
   */
  async triggerCommentNotification(commentData) {
    if (!this.isEnabled || this.testMode) return;

    try {
      const { postId, postAuthorId, commentAuthorId, commentAuthor, postTitle, space } = commentData;

      // Don't notify if user is commenting on their own post
      if (postAuthorId.toString() === commentAuthorId.toString()) {
        return;
      }

      // Get post author
      const postAuthor = await User.findById(postAuthorId);
      if (!postAuthor || !postAuthor.pushNotificationsEnabled) {
        logger.debug('Post author not found or notifications disabled', { postAuthorId });
        return;
      }

      // Create notification record
      const notification = new Notification({
        recipient: postAuthorId,
        sender: commentAuthorId,
        type: 'comment',
        title: 'New Comment',
        message: `${commentAuthor} commented on your post`,
        actionUrl: `/post/${postId}`,
        relatedPost: postId,
        senderUsername: commentAuthor,
        senderState: commentData.commentAuthorState || 'Unknown'
      });

      await notification.save();

      // Send push notification
      const pushResult = await pushNotificationService.sendToUser(
        postAuthorId,
        'New Comment',
        `${commentAuthor} commented on your post`,
        {
          type: 'comment',
          postId: postId.toString(),
          space,
          actionUrl: `/post/${postId}`
        }
      );

      // Track analytics
      analyticsService.trackEvent('notification_sent', {
        type: 'comment',
        recipientId: postAuthorId.toString(),
        senderId: commentAuthorId.toString(),
        space,
        success: pushResult.success
      });

      logger.info('Comment notification sent', {
        postId,
        postAuthor: postAuthor.username,
        commentAuthor,
        space,
        pushSuccess: pushResult.success
      });

    } catch (error) {
      logger.error('Failed to trigger comment notification', {
        error: error.message,
        commentData
      });
    }
  }

  /**
   * Trigger notification when someone reacts to a user's post
   */
  async triggerReactionNotification(reactionData) {
    if (!this.isEnabled || this.testMode) return;

    try {
      const { postId, postAuthorId, reactorId, reactor, reactionType, postTitle, space } = reactionData;

      // Don't notify if user is reacting to their own post
      if (postAuthorId.toString() === reactorId.toString()) {
        return;
      }

      // Get post author
      const postAuthor = await User.findById(postAuthorId);
      if (!postAuthor || !postAuthor.pushNotificationsEnabled) {
        logger.debug('Post author not found or notifications disabled', { postAuthorId });
        return;
      }

      // Check if we recently sent a reaction notification for this post (batching)
      const recentNotification = await Notification.findOne({
        recipient: postAuthorId,
        type: 'reaction',
        relatedPost: postId,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
      });

      let title, message;
      
      if (recentNotification) {
        // Update existing notification (batching)
        title = 'New Reactions';
        message = `${reactor} and others reacted to your post`;
        
        await Notification.findByIdAndUpdate(recentNotification._id, {
          message,
          updatedAt: new Date()
        });
      } else {
        // Create new notification
        const reactionEmoji = this.getReactionEmoji(reactionType);
        title = 'New Reaction';
        message = `${reactor} ${reactionEmoji} your post`;

        const notification = new Notification({
          recipient: postAuthorId,
          sender: reactorId,
          type: 'reaction',
          title,
          message,
          actionUrl: `/post/${postId}`,
          relatedPost: postId,
          senderUsername: reactor,
          senderState: reactionData.reactorState || 'Unknown'
        });

        await notification.save();
      }

      // Send push notification (always send, even for batched)
      const pushResult = await pushNotificationService.sendToUser(
        postAuthorId,
        title,
        message,
        {
          type: 'reaction',
          postId: postId.toString(),
          space,
          reactionType,
          actionUrl: `/post/${postId}`
        }
      );

      // Track analytics
      analyticsService.trackEvent('notification_sent', {
        type: 'reaction',
        recipientId: postAuthorId.toString(),
        senderId: reactorId.toString(),
        space,
        reactionType,
        batched: !!recentNotification,
        success: pushResult.success
      });

      logger.info('Reaction notification sent', {
        postId,
        postAuthor: postAuthor.username,
        reactor,
        reactionType,
        space,
        batched: !!recentNotification,
        pushSuccess: pushResult.success
      });

    } catch (error) {
      logger.error('Failed to trigger reaction notification', {
        error: error.message,
        reactionData
      });
    }
  }

  /**
   * Trigger notification for moderation actions
   */
  async triggerModerationNotification(moderationData) {
    if (!this.isEnabled || this.testMode) return;

    try {
      const { userId, moderatorId, moderator, action, reason, duration } = moderationData;

      // Get target user
      const targetUser = await User.findById(userId);
      if (!targetUser || !targetUser.pushNotificationsEnabled) {
        logger.debug('Target user not found or notifications disabled', { userId });
        return;
      }

      let title, message;
      
      switch (action) {
        case 'warn':
          title = 'Warning Issued';
          message = reason ? `You received a warning: ${reason}` : 'You received a warning from a moderator';
          break;
        case 'suspend':
          title = 'Account Suspended';
          message = duration ? 
            `Your account has been suspended for ${duration}` : 
            'Your account has been suspended';
          break;
        case 'ban':
          title = 'Account Banned';
          message = reason ? `Your account has been banned: ${reason}` : 'Your account has been banned';
          break;
        case 'post_removed':
          title = 'Post Removed';
          message = reason ? `Your post was removed: ${reason}` : 'Your post was removed by a moderator';
          break;
        case 'comment_removed':
          title = 'Comment Removed';
          message = reason ? `Your comment was removed: ${reason}` : 'Your comment was removed by a moderator';
          break;
        default:
          title = 'Moderation Action';
          message = 'A moderation action has been taken on your account';
      }

      // Create notification record
      const notification = new Notification({
        recipient: userId,
        sender: moderatorId,
        type: 'moderation',
        title,
        message,
        actionUrl: '/profile',
        senderUsername: moderator,
        senderState: 'Moderator'
      });

      await notification.save();

      // Send push notification
      const pushResult = await pushNotificationService.sendToUser(
        userId,
        title,
        message,
        {
          type: 'moderation',
          action,
          reason,
          actionUrl: '/profile'
        }
      );

      // Track analytics
      analyticsService.trackEvent('notification_sent', {
        type: 'moderation',
        recipientId: userId.toString(),
        senderId: moderatorId.toString(),
        action,
        success: pushResult.success
      });

      logger.info('Moderation notification sent', {
        targetUser: targetUser.username,
        moderator,
        action,
        reason,
        pushSuccess: pushResult.success
      });

    } catch (error) {
      logger.error('Failed to trigger moderation notification', {
        error: error.message,
        moderationData
      });
    }
  }

  /**
   * Trigger notification for general announcements (admin only)
   */
  async triggerAnnouncementNotification(announcementData) {
    if (!this.isEnabled || this.testMode) return;

    try {
      const { title, message, targetUsers, senderId, sender } = announcementData;

      // Get users to notify
      let users;
      if (targetUsers && targetUsers.length > 0) {
        users = await User.find({
          _id: { $in: targetUsers },
          pushNotificationsEnabled: true
        });
      } else {
        // Send to all users with notifications enabled
        users = await User.find({
          pushNotificationsEnabled: true,
          status: 'active'
        });
      }

      if (users.length === 0) {
        logger.warn('No users found for announcement notification');
        return;
      }

      // Create notification records
      const notifications = users.map(user => ({
        recipient: user._id,
        sender: senderId,
        type: 'announcement',
        title,
        message,
        actionUrl: '/',
        senderUsername: sender,
        senderState: 'Admin'
      }));

      await Notification.insertMany(notifications);

      // Send push notifications
      const userIds = users.map(user => user._id);
      const pushResult = await pushNotificationService.sendNotifications({
        userIds,
        title,
        body: message,
        data: {
          type: 'announcement',
          actionUrl: '/'
        }
      });

      // Track analytics
      analyticsService.trackEvent('notification_sent', {
        type: 'announcement',
        recipientCount: users.length,
        senderId: senderId.toString(),
        success: pushResult.success
      });

      logger.info('Announcement notification sent', {
        title,
        recipientCount: users.length,
        sender,
        pushSuccess: pushResult.success
      });

    } catch (error) {
      logger.error('Failed to trigger announcement notification', {
        error: error.message,
        announcementData
      });
    }
  }

  /**
   * Get emoji for reaction type
   */
  getReactionEmoji(reactionType) {
    const emojiMap = {
      'like': '👍',
      'love': '❤️',
      'laugh': '😂',
      'wow': '😮',
      'sad': '😢',
      'angry': '😠',
      'fire': '🔥',
      'clap': '👏'
    };
    return emojiMap[reactionType] || '👍';
  }

  /**
   * Enable/disable notification triggers
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    logger.info('Notification triggers toggled', { enabled });
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      pushServiceHealthy: pushNotificationService ? true : false
    };
  }
}

// Create singleton instance
const notificationTriggerService = new NotificationTriggerService();

module.exports = notificationTriggerService;