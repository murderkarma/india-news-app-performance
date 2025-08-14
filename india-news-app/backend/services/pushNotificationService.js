/**
 * Push Notification Service
 * Handles Expo Push Notifications with error handling, logging, and monitoring
 */

const { Expo } = require('expo-server-sdk');
const User = require('../userModel');
// Use a simple console logger to avoid pino transport conflicts
const logger = {
  info: (data, msg) => console.log(`[INFO] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  error: (data, msg) => console.error(`[ERROR] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  warn: (data, msg) => console.warn(`[WARN] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data),
  debug: (data, msg) => console.log(`[DEBUG] ${msg || ''}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data)
};
const analyticsService = require('./analyticsService');

class PushNotificationService {
  constructor() {
    // Create a new Expo SDK client
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true // Use FCM v1 API
    });
    
    // Notification delivery tracking
    this.deliveryStats = {
      sent: 0,
      delivered: 0,
      failed: 0,
      errors: []
    };
    
    logger.info('🔔 Push Notification Service initialized');
  }

  /**
   * Register a user's Expo push token
   */
  async registerToken(userId, expoPushToken) {
    try {
      // Validate the token format
      if (!Expo.isExpoPushToken(expoPushToken)) {
        throw new Error('Invalid Expo push token format');
      }

      // Update user with the new token
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          expoPushToken,
          tokenUpdatedAt: new Date()
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      logger.info({
        userId,
        username: user.username,
        tokenPreview: expoPushToken.substring(0, 20) + '...'
      }, '📱 Push token registered');

      // Track token registration
      analyticsService.trackEvent('push_token_registered', {
        userId,
        username: user.username
      });

      return {
        success: true,
        message: 'Push token registered successfully'
      };

    } catch (error) {
      logger.error({
        error: error.message,
        userId,
        expoPushToken: expoPushToken?.substring(0, 20) + '...'
      }, '❌ Failed to register push token');

      throw error;
    }
  }

  /**
   * Send push notifications to multiple users
   */
  async sendNotifications(payload) {
    const { userIds, title, body, data = {}, sound = 'default' } = payload;

    try {
      logger.info({
        userIds,
        title,
        recipientCount: userIds.length
      }, '🔔 Sending push notifications');

      // Get users with valid push tokens
      const users = await User.find({
        _id: { $in: userIds },
        expoPushToken: { $exists: true, $ne: null }
      }).select('_id username expoPushToken');

      if (users.length === 0) {
        logger.warn({ userIds }, '⚠️  No users found with valid push tokens');
        return {
          success: false,
          message: 'No users found with valid push tokens',
          sent: 0,
          failed: userIds.length
        };
      }

      // Create messages for each user
      const messages = users.map(user => ({
        to: user.expoPushToken,
        sound,
        title,
        body,
        data: {
          ...data,
          userId: user._id.toString(),
          username: user.username
        },
        // iOS specific
        badge: 1,
        // Android specific
        channelId: 'default',
        priority: 'high'
      }));

      // Send notifications in chunks (Expo recommends max 100 per request)
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets = [];
      let sentCount = 0;
      let failedCount = 0;

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
          
          // Count successful sends
          ticketChunk.forEach(ticket => {
            if (ticket.status === 'ok') {
              sentCount++;
            } else {
              failedCount++;
              logger.error({
                error: ticket.message,
                details: ticket.details
              }, '❌ Push notification ticket error');
            }
          });

        } catch (error) {
          logger.error({
            error: error.message,
            chunkSize: chunk.length
          }, '❌ Failed to send push notification chunk');
          
          failedCount += chunk.length;
        }
      }

      // Update delivery stats
      this.deliveryStats.sent += sentCount;
      this.deliveryStats.failed += failedCount;

      // Track analytics
      analyticsService.trackEvent('push_notifications_sent', {
        recipientCount: users.length,
        sentCount,
        failedCount,
        title
      });

      logger.info({
        title,
        recipientCount: users.length,
        sentCount,
        failedCount,
        successRate: ((sentCount / (sentCount + failedCount)) * 100).toFixed(1) + '%'
      }, '📊 Push notification batch completed');

      // Handle delivery receipts in background
      this.handleDeliveryReceipts(tickets).catch(error => {
        logger.error({ error: error.message }, '❌ Failed to handle delivery receipts');
      });

      return {
        success: sentCount > 0,
        message: `Sent ${sentCount} notifications, ${failedCount} failed`,
        sent: sentCount,
        failed: failedCount,
        tickets: tickets.map(ticket => ({
          id: ticket.id,
          status: ticket.status
        }))
      };

    } catch (error) {
      logger.error({
        error: error.message,
        userIds,
        title
      }, '❌ Failed to send push notifications');

      this.deliveryStats.failed += userIds.length;
      this.deliveryStats.errors.push({
        error: error.message,
        timestamp: new Date(),
        userIds,
        title
      });

      throw error;
    }
  }

  /**
   * Send notification to a single user
   */
  async sendToUser(userId, title, body, data = {}) {
    return this.sendNotifications({
      userIds: [userId],
      title,
      body,
      data
    });
  }

  /**
   * Handle delivery receipts (check if notifications were actually delivered)
   */
  async handleDeliveryReceipts(tickets) {
    try {
      // Filter tickets that have receipt IDs
      const receiptIds = tickets
        .filter(ticket => ticket.status === 'ok' && ticket.id)
        .map(ticket => ticket.id);

      if (receiptIds.length === 0) {
        return;
      }

      // Wait a bit before checking receipts
      await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds

      // Get delivery receipts in chunks
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      let deliveredCount = 0;
      let failedDeliveryCount = 0;

      for (const chunk of receiptIdChunks) {
        try {
          const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
          
          for (const receiptId in receipts) {
            const receipt = receipts[receiptId];
            
            if (receipt.status === 'ok') {
              deliveredCount++;
            } else {
              failedDeliveryCount++;
              logger.error({
                receiptId,
                error: receipt.message,
                details: receipt.details
              }, '❌ Push notification delivery failed');
            }
          }

        } catch (error) {
          logger.error({
            error: error.message,
            chunkSize: chunk.length
          }, '❌ Failed to get delivery receipts');
        }
      }

      // Update delivery stats
      this.deliveryStats.delivered += deliveredCount;

      logger.info({
        deliveredCount,
        failedDeliveryCount,
        totalChecked: receiptIds.length
      }, '📋 Delivery receipts processed');

    } catch (error) {
      logger.error({
        error: error.message
      }, '❌ Failed to handle delivery receipts');
    }
  }

  /**
   * Get notification delivery statistics
   */
  getDeliveryStats() {
    const total = this.deliveryStats.sent + this.deliveryStats.failed;
    const successRate = total > 0 ? ((this.deliveryStats.sent / total) * 100).toFixed(1) : 0;
    const deliveryRate = this.deliveryStats.sent > 0 ? 
      ((this.deliveryStats.delivered / this.deliveryStats.sent) * 100).toFixed(1) : 0;

    return {
      ...this.deliveryStats,
      total,
      successRate: parseFloat(successRate),
      deliveryRate: parseFloat(deliveryRate),
      recentErrors: this.deliveryStats.errors.slice(-10) // Last 10 errors
    };
  }

  /**
   * Reset delivery statistics (for daily/weekly resets)
   */
  resetStats() {
    this.deliveryStats = {
      sent: 0,
      delivered: 0,
      failed: 0,
      errors: []
    };
    
    logger.info('📊 Push notification stats reset');
  }

  /**
   * Validate notification payload
   */
  validatePayload(payload) {
    const { userIds, title, body } = payload;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      throw new Error('userIds must be a non-empty array');
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      throw new Error('title is required and must be a non-empty string');
    }

    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      throw new Error('body is required and must be a non-empty string');
    }

    // Validate title and body length (Expo limits)
    if (title.length > 100) {
      throw new Error('title must be 100 characters or less');
    }

    if (body.length > 200) {
      throw new Error('body must be 200 characters or less');
    }

    return true;
  }

  /**
   * Check service health
   */
  async healthCheck() {
    try {
      // Check if Expo service is accessible
      const testToken = 'ExponentPushToken[test]';
      const isValidFormat = Expo.isExpoPushToken(testToken);
      
      const stats = this.getDeliveryStats();
      
      return {
        status: 'healthy',
        service: 'Push Notification Service',
        expo: {
          accessible: true,
          tokenValidation: isValidFormat
        },
        stats,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'Push Notification Service',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Create singleton instance
const pushNotificationService = new PushNotificationService();

module.exports = pushNotificationService;