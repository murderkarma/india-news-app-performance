const express = require('express');
const router = express.Router();
const Report = require('./reportModel');
const User = require('./userModel');
const ForumThread = require('./forumThreadModel');
const TeaIslandPost = require('./teaIslandPostModel');
const Comment = require('./commentModel');
const Notification = require('./notificationModel');
const auth = require('./middleware/auth');
const { requireAuth, moderatorAuth, adminAuth, requireActiveUser } = require('./middleware/adminAuth');

// POST /report - Submit a report (any authenticated user)
router.post('/report', auth, requireAuth, requireActiveUser, async (req, res) => {
  try {
    const {
      reportType,
      postId,
      commentId,
      threadId,
      threadReplyId,
      reportedUserId,
      reason,
      description
    } = req.body;

    const userId = req.userFull._id;
    const username = req.userFull.username;
    const userState = req.userFull.state;

    console.log(`🚨 POST /api/moderation/report - User: ${username}, Type: ${reportType}, Reason: ${reason}`);

    // Validate required fields
    if (!reportType || !reason) {
      return res.status(400).json({ error: 'Report type and reason are required' });
    }

    // Validate that at least one content reference is provided
    const hasContentRef = postId || commentId || threadId || threadReplyId || reportedUserId;
    if (!hasContentRef) {
      return res.status(400).json({ 
        error: 'Must specify content to report (postId, commentId, threadId, threadReplyId, or reportedUserId)' 
      });
    }

    // Validate reportType matches content reference
    const validCombinations = {
      'post': ['postId'],
      'comment': ['commentId'],
      'thread': ['threadId'],
      'thread_reply': ['threadId', 'threadReplyId'],
      'user': ['reportedUserId']
    };

    const requiredFields = validCombinations[reportType];
    if (!requiredFields) {
      return res.status(400).json({ error: 'Invalid report type' });
    }

    // Check if required fields for this report type are present
    const hasRequiredFields = requiredFields.every(field => {
      if (field === 'postId') return postId;
      if (field === 'commentId') return commentId;
      if (field === 'threadId') return threadId;
      if (field === 'threadReplyId') return threadReplyId;
      if (field === 'reportedUserId') return reportedUserId;
      return false;
    });

    if (!hasRequiredFields) {
      return res.status(400).json({ 
        error: `For ${reportType} reports, you must provide: ${requiredFields.join(', ')}` 
      });
    }

    // Prevent self-reporting (except for user reports)
    if (reportType !== 'user' && reportedUserId && reportedUserId.toString() === userId.toString()) {
      return res.status(400).json({ error: 'Cannot report your own content' });
    }

    const report = await Report.createReport({
      reportType,
      postId,
      commentId,
      threadId,
      threadReplyId,
      reportedUserId,
      reportedBy: userId,
      reporterUsername: username,
      reporterState: userState,
      reason,
      description
    });

    console.log(`✅ Report created: ${report._id}`);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report: {
        id: report._id,
        type: report.reportType,
        reason: report.reason,
        status: report.status,
        severity: report.severity,
        createdAt: report.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// GET /admin/reports - Get reports with filtering (moderators and admins)
router.get('/admin/reports', moderatorAuth, async (req, res) => {
  try {
    const {
      status,
      reportType,
      severity,
      reason,
      page = 1,
      limit = 20,
      sortBy = 'priority'
    } = req.query;

    console.log(`📋 GET /api/moderation/admin/reports - Moderator: ${req.userFull.username}`);

    const filters = { status, reportType, severity, reason };
    const options = { page, limit, sortBy };

    const result = await Report.getReports(filters, options);

    res.json({
      success: true,
      reports: result.reports.map(report => ({
        id: report._id,
        type: report.reportType,
        reason: report.reason,
        description: report.description,
        status: report.status,
        severity: report.severity,
        priority: report.priority,
        reportCount: report.reportCount,
        reporter: {
          username: report.reporterUsername,
          state: report.reporterState
        },
        reviewedBy: report.reviewedBy ? report.reviewedBy.username : null,
        reviewedAt: report.reviewedAt,
        actionTaken: report.actionTaken,
        adminNotes: report.adminNotes,
        createdAt: report.createdAt,
        // Content references
        postId: report.postId,
        commentId: report.commentId,
        threadId: report.threadId,
        threadReplyId: report.threadReplyId,
        reportedUserId: report.reportedUserId
      })),
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// GET /admin/reports/stats - Get report statistics (moderators and admins)
router.get('/admin/reports/stats', moderatorAuth, async (req, res) => {
  try {
    console.log(`📊 GET /api/moderation/admin/reports/stats - Moderator: ${req.userFull.username}`);

    const stats = await Report.getReportStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching report stats:', error);
    res.status(500).json({ error: 'Failed to fetch report statistics' });
  }
});

// PATCH /admin/reports/:id/review - Review a report (moderators and admins)
router.patch('/admin/reports/:id/review', moderatorAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, actionTaken, adminNotes } = req.body;
    const moderatorId = req.userFull._id;
    const moderatorUsername = req.userFull.username;

    console.log(`🔍 PATCH /api/moderation/admin/reports/${id}/review - Moderator: ${moderatorUsername}`);

    if (!status || !['reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required (reviewing, resolved, dismissed)' });
    }

    const report = await Report.findById(id);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Update report
    report.status = status;
    report.reviewedBy = moderatorId;
    report.reviewedAt = new Date();
    
    if (actionTaken) {
      report.actionTaken = actionTaken;
    }
    
    if (adminNotes) {
      report.adminNotes = adminNotes;
    }

    await report.save();

    console.log(`✅ Report ${id} reviewed by ${moderatorUsername}: ${status}`);

    res.json({
      success: true,
      message: 'Report reviewed successfully',
      report: {
        id: report._id,
        status: report.status,
        actionTaken: report.actionTaken,
        reviewedBy: moderatorUsername,
        reviewedAt: report.reviewedAt
      }
    });

  } catch (error) {
    console.error('Error reviewing report:', error);
    res.status(500).json({ error: 'Failed to review report' });
  }
});

// DELETE /admin/post/:id - Remove post content (admins only)
router.delete('/admin/post/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUsername = req.userFull.username;

    console.log(`🗑️ DELETE /api/moderation/admin/post/${id} - Admin: ${adminUsername}`);

    const post = await TeaIslandPost.findById(id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    // Mark post as removed instead of deleting
    post.isRemoved = true;
    post.removedBy = req.userFull._id;
    post.removedAt = new Date();
    post.removalReason = reason || 'Content removed by admin';
    
    await post.save();

    console.log(`✅ Post ${id} removed by admin ${adminUsername}`);

    res.json({
      success: true,
      message: 'Post removed successfully',
      removedAt: post.removedAt,
      reason: post.removalReason
    });

  } catch (error) {
    console.error('Error removing post:', error);
    res.status(500).json({ error: 'Failed to remove post' });
  }
});

// DELETE /admin/thread/:id - Remove thread (admins only)
router.delete('/admin/thread/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUsername = req.userFull.username;

    console.log(`🗑️ DELETE /api/moderation/admin/thread/${id} - Admin: ${adminUsername}`);

    const thread = await ForumThread.findById(id);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Mark thread as removed
    thread.isRemoved = true;
    thread.removedBy = req.userFull._id;
    thread.removedAt = new Date();
    thread.removalReason = reason || 'Thread removed by admin';
    
    await thread.save();

    console.log(`✅ Thread ${id} removed by admin ${adminUsername}`);

    res.json({
      success: true,
      message: 'Thread removed successfully',
      removedAt: thread.removedAt,
      reason: thread.removalReason
    });

  } catch (error) {
    console.error('Error removing thread:', error);
    res.status(500).json({ error: 'Failed to remove thread' });
  }
});

// PATCH /admin/user/:id/warn - Warn a user (moderators and admins)
router.patch('/admin/user/:id/warn', moderatorAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const moderatorUsername = req.userFull.username;

    console.log(`⚠️ PATCH /api/moderation/admin/user/${id}/warn - Moderator: ${moderatorUsername}`);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Increment warnings
    user.warnings += 1;
    user.status = 'warned';
    
    await user.save();

    // Create notification for user
    try {
      await Notification.createNotification({
        recipient: user._id,
        sender: req.userFull._id,
        type: 'post_comment', // Using existing type, could add 'moderation' type later
        title: 'Account Warning',
        message: `You have received a warning from moderation. Reason: ${reason || 'Policy violation'}. Total warnings: ${user.warnings}`,
        actionUrl: '/profile/warnings',
        senderUsername: 'Moderation Team',
        senderState: 'System'
      });
    } catch (notificationError) {
      console.error('Failed to create warning notification:', notificationError);
    }

    console.log(`✅ User ${user.username} warned by ${moderatorUsername}. Total warnings: ${user.warnings}`);

    res.json({
      success: true,
      message: 'User warned successfully',
      user: {
        id: user._id,
        username: user.username,
        warnings: user.warnings,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Error warning user:', error);
    res.status(500).json({ error: 'Failed to warn user' });
  }
});

// PATCH /admin/user/:id/suspend - Suspend a user (admins only)
router.patch('/admin/user/:id/suspend', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 7, reason } = req.body;
    const adminUsername = req.userFull.username;

    console.log(`🚫 PATCH /api/moderation/admin/user/${id}/suspend - Admin: ${adminUsername}`);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Set suspension
    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + parseInt(days));
    
    user.status = 'suspended';
    user.suspendedUntil = suspendedUntil;
    
    await user.save();

    console.log(`✅ User ${user.username} suspended by ${adminUsername} until ${suspendedUntil.toLocaleDateString()}`);

    res.json({
      success: true,
      message: 'User suspended successfully',
      user: {
        id: user._id,
        username: user.username,
        status: user.status,
        suspendedUntil: user.suspendedUntil
      }
    });

  } catch (error) {
    console.error('Error suspending user:', error);
    res.status(500).json({ error: 'Failed to suspend user' });
  }
});

// PATCH /admin/user/:id/ban - Ban a user permanently (admins only)
router.patch('/admin/user/:id/ban', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUsername = req.userFull.username;

    console.log(`🔨 PATCH /api/moderation/admin/user/${id}/ban - Admin: ${adminUsername}`);

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Set ban
    user.status = 'banned';
    user.bannedAt = new Date();
    user.bannedReason = reason || 'Banned by admin';
    
    await user.save();

    console.log(`✅ User ${user.username} banned by ${adminUsername}`);

    res.json({
      success: true,
      message: 'User banned successfully',
      user: {
        id: user._id,
        username: user.username,
        status: user.status,
        bannedAt: user.bannedAt,
        bannedReason: user.bannedReason
      }
    });

  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

module.exports = router;