const express = require('express');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('./userModel');
const asyncWrap = require('./utils/asyncWrap');
const router = express.Router();

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, {
    message: "Username can only contain letters, numbers, and underscores"
  }),
  password: z.string().min(6),
  gender: z.enum(['male', 'female', 'other']),
  state: z.string().optional()
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

const updateStateSchema = z.object({
  state: z.string().min(1)
});

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Register new user
router.post('/register', asyncWrap(async (req, res) => {
  // Validate request body
  const validatedData = registerSchema.parse(req.body);
  const { username, password, state, gender } = validatedData;

  // Check if username already exists
  const existingUser = await User.findOne({ username: username.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({ error: 'Username already taken' });
  }

  // Create new user
  const user = new User({
    username: username.toLowerCase(),
    passwordHash: password, // Will be hashed by pre-save middleware
    state: state || null, // Optional state, will be set during onboarding
    gender
  });

  await user.save();

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: {
      id: user._id,
      username: user.username,
      state: user.state,
      gender: user.gender,
      karma: user.karma,
      createdAt: user.createdAt
    }
  });
}));

// Login user
router.post('/login', asyncWrap(async (req, res) => {
  // Validate request body
  const { username, password } = loginSchema.parse(req.body);

  // Find user
  const user = await User.findOne({ username: username.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Check password
  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { userId: user._id, username: user.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user._id,
      username: user.username,
      state: user.state,
      gender: user.gender,
      karma: user.karma,
      createdAt: user.createdAt
    }
  });
}));

// Get current user profile
router.get('/profile', authenticateToken, asyncWrap(async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      username: req.user.username,
      state: req.user.state,
      gender: req.user.gender,
      karma: req.user.karma,
      createdAt: req.user.createdAt
    }
  });
}));

// Verify token (for frontend auth checks)
router.get('/verify', authenticateToken, asyncWrap(async (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user._id,
      username: req.user.username,
      state: req.user.state,
      gender: req.user.gender,
      karma: req.user.karma
    }
  });
}));

// Update user state (for onboarding)
router.patch('/update-state', authenticateToken, asyncWrap(async (req, res) => {
  // Validate request body
  const { state } = updateStateSchema.parse(req.body);

  // Update user's state
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { state },
    { new: true }
  );

  res.json({
    message: 'State updated successfully',
    user: {
      id: user._id,
      username: user.username,
      state: user.state,
      gender: user.gender,
      karma: user.karma,
      createdAt: user.createdAt
    }
  });
}));

// Export both router and middleware
module.exports = {
  router,
  authenticateToken
};