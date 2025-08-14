const express = require('express');
const router = express.Router();
const Notification = require('./notificationModel');
const auth = require('./middleware/auth');
const pushNotificationService = require('./services/pushNotificationService');
const { logger } = require('./config/logger');

// GET /notifications - Get user's notifications with pagination
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const { 
      page = 1, 
      limit = 20, 
      unreadOnly = false,
      type = null 
    } = req.query;

    console.log(`🔔 GET /api/notifications - User: ${req.user.username}, Page: ${page}`);

    // Build query
    const query = {
      recipient: userId,
      isDeleted: false
    };

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    if (type) {
      query.type = type;
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('sender', 'username state')
      .lean();

    // Get total count and unread count
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(userId);

    // Format notifications for response
    const formattedNotifications = notifications.map(notification => ({
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      isRead: notification.isRead,
      sender: {
        username: notification.senderUsername,
        state: notification.senderState
      },
      createdAt: notification.createdAt,
      timeAgo: getTimeAgo(notification.createdAt),
      relatedPost: notification.relatedPost,
      relatedThread: notification.relatedThread,
      relatedComment: notification.relatedComment
    }));

    console.log(`📊 Found ${notifications.length} notifications, ${unreadCount} unread`);

    res.json({
      success: true,
      notifications: formattedNotifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: notifications.length === parseInt(limit)
      },
      unreadCount
    });

  } catch (error) {
    console.error('❌ Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// GET /notifications/unread-count - Get unread notification count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;
    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      unreadCount
    });

  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// PATCH /notifications/:id/read - Mark single notification as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.userId;

    console.log(`🔔 PATCH /api/notifications/${id}/read - User: ${req.user.username}`);

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: userId,
        isRead: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found or already read' });
    }

    console.log(`✅ Notification ${id} marked as read`);

    res.json({
      success: true,
      message: 'Notification marked as read',
      notification: {
        id: notification._id,
        isRead: notification.isRead,
        readAt: notification.readAt
      }
    });

  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// PATCH /notifications/mark-all-read - Mark all notifications as read
router.patch('/mark-all-read', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;

    console.log(`🔔 PATCH /api/notifications/mark-all-read - User: ${req.user.username}`);

    const result = await Notification.updateMany(
      {
        recipient: userId,
        isRead: false,
        isDeleted: false
      },
      {
        $set: {
          isRead: true,
          readAt: new Date()
        }
      }
    );

    console.log(`✅ Marked ${result.modifiedCount} notifications as read`);

    res.json({
      success: true,
      message: `Marked ${result.modifiedCount} notifications as read`,
      markedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// PATCH /notifications/mark-read - Mark multiple notifications as read
router.patch('/mark-read', auth, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user._id || req.user.userId;

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array is required' });
    }

    console.log(`🔔 PATCH /api/notifications/mark-read - User: ${req.user.username}, Count: ${notificationIds.length}`);

    const markedCount = await Notification.markAsRead(notificationIds, userId);

    console.log(`✅ Marked ${markedCount} notifications as read`);

    res.json({
      success: true,
      message: `Marked ${markedCount} notifications as read`,
      markedCount
    });

  } catch (error) {
    console.error('❌ Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// DELETE /notifications/:id - Delete a notification
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id || req.user.userId;

    console.log(`🔔 DELETE /api/notifications/${id} - User: ${req.user.username}`);

    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipient: userId
      },
      {
        $set: { isDeleted: true }
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    console.log(`🗑️ Notification ${id} deleted`);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// DELETE /notifications/clear-all - Clear all notifications (mark as deleted)
router.delete('/clear-all', auth, async (req, res) => {
  try {
    const userId = req.user._id || req.user.userId;

    console.log(`🔔 DELETE /api/notifications/clear-all - User: ${req.user.username}`);

    const result = await Notification.updateMany(
      {
        recipient: userId,
        isDeleted: false
      },
      {
        $set: { isDeleted: true }
      }
    );

    console.log(`🗑️ Cleared ${result.modifiedCount} notifications`);

    res.json({
      success: true,
      message: `Cleared ${result.modifiedCount} notifications`,
      clearedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// Helper function for time formatting
function getTimeAgo(createdAt) {
  const now = new Date();
  const diff = now - createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return createdAt.toLocaleDateString();
}

// POST /notifications/token - Register push notification token
router.post('/token', auth, async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    const userId = req.user._id || req.user.userId;

    console.log(`🔔 POST /api/notifications/token - User: ${req.user.username}`);

    if (!expoPushToken) {
      return res.status(400).json({ error: 'expoPushToken is required' });
    }

    // Register token with push notification service
    const result = await pushNotificationService.registerToken(userId, expoPushToken);

    logger.info({
      userId,
      username: req.user.username,
      tokenPreview: expoPushToken.substring(0, 20) + '...'
    }, '📱 Push token registered successfully');

    res.json({
      success: true,
      message: 'Push notification token registered successfully',
      ...result
    });

  } catch (error) {
    logger.error({
      error: error.message,
      userId: req.user._id || req.user.userId,
      username: req.user.username
    }, '❌ Failed to register push token');

    res.status(500).json({
      error: 'Failed to register push notification token',
      details: error.message
    });
  }
});

// POST /notifications/send - Send push notifications (admin/moderator only)
router.post('/send', auth, async (req, res) => {
  try {
    const { userIds, title, body, data } = req.body;
    const sender = req.user;

    console.log(`🔔 POST /api/notifications/send - Sender: ${sender.username}, Recipients: ${userIds?.length || 0}`);

    // Check if user has permission to send notifications
    if (!sender.isModerator() && !sender.isAdmin()) {
      return res.status(403).json({
        error: 'Insufficient permissions. Only moderators and admins can send notifications.'
      });
    }

    // Validate payload
    pushNotificationService.validatePayload({ userIds, title, body, data });

    // Send notifications
    const result = await pushNotificationService.sendNotifications({
      userIds,
      title,
      body,
      data
    });

    logger.info({
      sender: sender.username,
      recipientCount: userIds.length,
      sentCount: result.sent,
      failedCount: result.failed,
      title
    }, '📤 Push notifications sent');

    res.json({
      success: result.success,
      message: result.message,
      sent: result.sent,
      failed: result.failed,
      tickets: result.tickets
    });

  } catch (error) {
    logger.error({
      error: error.message,
      sender: req.user.username,
      payload: { userIds: req.body.userIds?.length, title: req.body.title }
    }, '❌ Failed to send push notifications');

    res.status(500).json({
      error: 'Failed to send push notifications',
      details: error.message
    });
  }
});

// GET /notifications/push/stats - Get push notification delivery statistics
router.get('/push/stats', auth, async (req, res) => {
  try {
    const user = req.user;

    // Only allow moderators and admins to view stats
    if (!user.isModerator() && !user.isAdmin()) {
      return res.status(403).json({
        error: 'Insufficient permissions. Only moderators and admins can view notification stats.'
      });
    }

    const stats = pushNotificationService.getDeliveryStats();

    logger.info({
      requestedBy: user.username,
      stats: {
        total: stats.total,
        sent: stats.sent,
        delivered: stats.delivered,
        failed: stats.failed,
        successRate: stats.successRate,
        deliveryRate: stats.deliveryRate
      }
    }, '📊 Push notification stats requested');

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    logger.error({
      error: error.message,
      requestedBy: req.user.username
    }, '❌ Failed to get push notification stats');

    res.status(500).json({
      error: 'Failed to get push notification statistics',
      details: error.message
    });
  }
});

// POST /notifications/push/health - Check push notification service health
router.get('/push/health', auth, async (req, res) => {
  try {
    const user = req.user;

    // Only allow moderators and admins to check health
    if (!user.isModerator() && !user.isAdmin()) {
      return res.status(403).json({
        error: 'Insufficient permissions. Only moderators and admins can check service health.'
      });
    }

    const health = await pushNotificationService.healthCheck();

    res.json({
      success: true,
      health
    });

  } catch (error) {
    logger.error({
      error: error.message,
      requestedBy: req.user.username
    }, '❌ Failed to check push notification service health');

    res.status(500).json({
      error: 'Failed to check push notification service health',
      details: error.message
    });
  }
});

// PATCH /notifications/push/settings - Update user's push notification preferences
router.patch('/push/settings', auth, async (req, res) => {
  try {
    const { pushNotificationsEnabled } = req.body;
    const userId = req.user._id || req.user.userId;

    console.log(`🔔 PATCH /api/notifications/push/settings - User: ${req.user.username}, Enabled: ${pushNotificationsEnabled}`);

    if (typeof pushNotificationsEnabled !== 'boolean') {
      return res.status(400).json({ error: 'pushNotificationsEnabled must be a boolean' });
    }

    // Update user's push notification preference
    const User = require('./userModel');
    const user = await User.findByIdAndUpdate(
      userId,
      { pushNotificationsEnabled },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info({
      userId,
      username: user.username,
      pushNotificationsEnabled
    }, '⚙️  Push notification settings updated');

    res.json({
      success: true,
      message: 'Push notification settings updated successfully',
      pushNotificationsEnabled: user.pushNotificationsEnabled
    });

  } catch (error) {
    logger.error({
      error: error.message,
      userId: req.user._id || req.user.userId,
      username: req.user.username
    }, '❌ Failed to update push notification settings');

    res.status(500).json({
      error: 'Failed to update push notification settings',
      details: error.message
    });
  }
});

module.exports = router;