const User = require('../userModel');

// Middleware to check if user is authenticated and active
const requireAuth = async (req, res, next) => {
  try {
    // Check if user is authenticated (assuming auth middleware already ran)
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get full user data to check status
    const user = await User.findById(req.user._id || req.user.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user can perform actions (not banned/suspended)
    if (!user.canPerformActions()) {
      let message = 'Account access restricted';
      
      if (user.status === 'banned') {
        message = 'Account is permanently banned';
      } else if (user.status === 'suspended') {
        const suspendedUntil = user.suspendedUntil ? user.suspendedUntil.toLocaleDateString() : 'indefinitely';
        message = `Account is suspended until ${suspendedUntil}`;
      }
      
      return res.status(403).json({ 
        error: message,
        status: user.status,
        suspendedUntil: user.suspendedUntil
      });
    }

    // Update last active timestamp
    user.updateLastActive().catch(err => {
      console.error('Failed to update last active:', err);
    });

    // Attach full user data to request
    req.userFull = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication check failed' });
  }
};

// Middleware to check if user is a moderator or admin
const requireModerator = async (req, res, next) => {
  try {
    // Ensure user is authenticated first
    if (!req.userFull) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.userFull.isModerator()) {
      return res.status(403).json({ 
        error: 'Moderator access required',
        userRole: req.userFull.role 
      });
    }

    next();
  } catch (error) {
    console.error('Moderator auth error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Middleware to check if user is an admin
const requireAdmin = async (req, res, next) => {
  try {
    // Ensure user is authenticated first
    if (!req.userFull) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.userFull.isAdmin()) {
      return res.status(403).json({ 
        error: 'Admin access required',
        userRole: req.userFull.role 
      });
    }

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Combined middleware for moderator access (auth + moderator check)
const moderatorAuth = [requireAuth, requireModerator];

// Combined middleware for admin access (auth + admin check)
const adminAuth = [requireAuth, requireAdmin];

// Middleware to check user status for posting/commenting
const requireActiveUser = async (req, res, next) => {
  try {
    if (!req.userFull) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Additional checks for posting/commenting
    if (req.userFull.status === 'warned' && req.userFull.warnings >= 3) {
      return res.status(403).json({ 
        error: 'Account has too many warnings. Contact support.',
        warnings: req.userFull.warnings 
      });
    }

    next();
  } catch (error) {
    console.error('Active user check error:', error);
    res.status(500).json({ error: 'User status check failed' });
  }
};

module.exports = {
  requireAuth,
  requireModerator,
  requireAdmin,
  moderatorAuth,
  adminAuth,
  requireActiveUser
};