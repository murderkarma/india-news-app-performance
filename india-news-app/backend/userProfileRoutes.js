const express = require('express');
const User = require('./userModel');
const TeaIslandPost = require('./teaIslandPostModel');
const ForumThread = require('./forumThreadModel');
const { authenticateToken } = require('./authRoutes');
const router = express.Router();

// Edit user profile
router.patch('/edit-profile', authenticateToken, async (req, res) => {
  try {
    const { bio, avatar, isDMEnabled, allowAnonDM } = req.body;
    const userId = req.user._id;

    // Validation
    if (bio && bio.length > 500) {
      return res.status(400).json({ error: 'Bio must be 500 characters or less' });
    }

    // Build update object with only provided fields
    const updateFields = {};
    if (bio !== undefined) updateFields.bio = bio;
    if (avatar !== undefined) updateFields.avatar = avatar;
    if (isDMEnabled !== undefined) updateFields.isDMEnabled = isDMEnabled;
    if (allowAnonDM !== undefined) updateFields.allowAnonDM = allowAnonDM;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        bio: updatedUser.bio,
        avatar: updatedUser.avatar,
        isDMEnabled: updatedUser.isDMEnabled,
        allowAnonDM: updatedUser.allowAnonDM
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get public user profile
router.get('/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user is banned (don't show banned user profiles)
    if (user.status === 'banned') {
      return res.status(404).json({ error: 'User not found' });
    }

    // Calculate post and comment counts using aggregation
    const [postCount, commentCount] = await Promise.all([
      // Count Tea Island posts
      TeaIslandPost.countDocuments({ 
        author: userId, 
        isRemoved: { $ne: true } 
      }),
      
      // Count forum thread comments (replies)
      ForumThread.aggregate([
        { $unwind: '$replies' },
        { 
          $match: { 
            'replies.author': userId,
            'replies.isRemoved': { $ne: true }
          }
        },
        { $count: 'total' }
      ]).then(result => result[0]?.total || 0)
    ]);

    // Return public profile data
    res.json({
      username: user.username,
      avatar: user.avatar,
      state: user.state,
      gender: user.gender,
      karma: user.karma,
      bio: user.bio,
      joinedAt: user.createdAt,
      totalPosts: postCount,
      totalComments: commentCount,
      isDMEnabled: user.isDMEnabled,
      // Don't expose sensitive fields like role, status, etc.
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get available avatars (for frontend avatar selection)
router.get('/avatars/list', (req, res) => {
  // Define available avatar categories and files
  const avatars = {
    neutral: [
      'default.png',
      'neutral_1.png',
      'neutral_2.png',
      'neutral_3.png'
    ],
    anime: [
      'anime_naruto.png',
      'anime_sakura.png',
      'anime_sasuke.png',
      'anime_kakashi.png',
      'anime_hinata.png'
    ],
    kpop: [
      'kpop_iu.png',
      'kpop_bts.png',
      'kpop_blackpink.png',
      'kpop_twice.png'
    ],
    indian: [
      'indian_traditional_1.png',
      'indian_traditional_2.png',
      'indian_bollywood_1.png',
      'indian_bollywood_2.png'
    ]
  };

  res.json({ avatars });
});

// Check if username is available (for potential future username changes)
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username || username.length < 3 || username.length > 20) {
      return res.status(400).json({ 
        available: false, 
        error: 'Username must be between 3 and 20 characters' 
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ 
        available: false, 
        error: 'Username can only contain letters, numbers, and underscores' 
      });
    }

    const existingUser = await User.findOne({ 
      username: username.toLowerCase() 
    });

    res.json({ 
      available: !existingUser,
      username: username.toLowerCase()
    });

  } catch (error) {
    console.error('Username check error:', error);
    res.status(500).json({ error: 'Failed to check username availability' });
  }
});

module.exports = router;