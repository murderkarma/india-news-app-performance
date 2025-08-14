const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/ // Only alphanumeric and underscore
  },
  passwordHash: {
    type: String,
    required: true
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
  gender: {
    type: String,
    required: true,
    enum: ['male', 'female', 'other']
  },
  karma: {
    type: Number,
    default: 0
  },
  // Profile fields
  bio: {
    type: String,
    maxlength: 500,
    default: ''
  },
  avatar: {
    type: String,
    default: 'neutral/default.png'
  },
  isDMEnabled: {
    type: Boolean,
    default: true
  },
  allowAnonDM: {
    type: Boolean,
    default: true
  },
  // Role and moderation fields
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin'],
    default: 'user'
  },
  status: {
    type: String,
    enum: ['active', 'warned', 'suspended', 'banned'],
    default: 'active'
  },
  // Moderation tracking
  warnings: {
    type: Number,
    default: 0
  },
  suspendedUntil: {
    type: Date,
    default: null
  },
  bannedAt: {
    type: Date,
    default: null
  },
  bannedReason: {
    type: String,
    default: null
  },
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  // Push notification fields
  expoPushToken: {
    type: String,
    default: null
  },
  tokenUpdatedAt: {
    type: Date,
    default: null
  },
  pushNotificationsEnabled: {
    type: Boolean,
    default: true
  }
});

// Index for performance
userSchema.index({ username: 1 });
userSchema.index({ state: 1 });
userSchema.index({ gender: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('passwordHash')) return next();
  
  try {
    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Check if user can perform actions (not banned/suspended)
userSchema.methods.canPerformActions = function() {
  if (this.status === 'banned') return false;
  if (this.status === 'suspended' && this.suspendedUntil && this.suspendedUntil > new Date()) {
    return false;
  }
  return true;
};

// Check if user is admin or moderator
userSchema.methods.isModerator = function() {
  return ['moderator', 'admin'].includes(this.role);
};

userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

// Update last active timestamp
userSchema.methods.updateLastActive = function() {
  this.lastActive = new Date();
  return this.save();
};

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);