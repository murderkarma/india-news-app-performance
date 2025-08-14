/**
 * Enterprise-grade access control gates for multi-space forum system
 * Provides granular, reusable middleware for space-based access control
 */

const { SPACE_CONFIG } = require('../models/postModel');

/**
 * Space gate - validates that the requested space is allowed
 * @param {string[]} allowedSpaces - Array of allowed space names
 * @returns {Function} Express middleware
 */
const spaceGate = (allowedSpaces = []) => {
  return (req, res, next) => {
    const space = req.body.space || req.query.space || req.params.space;
    
    if (!space) {
      return res.status(400).json({
        success: false,
        error: 'Space parameter is required',
        code: 'SPACE_MISSING'
      });
    }
    
    if (!allowedSpaces.includes(space)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Space '${space}' not allowed for this endpoint`,
        code: 'SPACE_FORBIDDEN',
        allowedSpaces
      });
    }
    
    // Attach space to request for downstream use
    req.space = space;
    next();
  };
};

/**
 * Gender gate - enforces gender-based access control for Tea/Brospace
 * @param {string} requiredGender - 'male', 'female', or null for no restriction
 * @returns {Function} Express middleware
 */
const genderGate = (requiredGender) => {
  return (req, res, next) => {
    // Skip if no gender requirement
    if (!requiredGender) {
      return next();
    }
    
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Check gender requirement
    if (req.user.gender !== requiredGender) {
      const spaceName = requiredGender === 'female' ? 'Tea' : 'Brospace';
      return res.status(403).json({
        success: false,
        error: `Access denied. ${spaceName} is restricted to ${requiredGender} users only`,
        code: 'GENDER_RESTRICTED',
        requiredGender,
        userGender: req.user.gender
      });
    }
    
    next();
  };
};

/**
 * State gate - enforces state-based posting restrictions for Local
 * Only applies to POST/PUT/DELETE operations, reads are unrestricted
 * @param {boolean} enforceOnRead - Whether to enforce on GET requests (default: false)
 * @returns {Function} Express middleware
 */
const stateGate = (enforceOnRead = false) => {
  return (req, res, next) => {
    // Skip for read operations unless explicitly enforced
    if (!enforceOnRead && req.method === 'GET') {
      return next();
    }
    
    // Ensure user is authenticated for write operations
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Get state from various sources
    const targetState = req.body.state || req.params.state || req.query.state;
    
    // For write operations, enforce state matching
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (targetState && targetState !== req.user.state) {
        return res.status(403).json({
          success: false,
          error: `Access denied. You can only post in your own state (${req.user.state})`,
          code: 'STATE_RESTRICTED',
          userState: req.user.state,
          targetState
        });
      }
    }
    
    next();
  };
};

/**
 * Space-specific validation gate
 * Validates content against space-specific rules and categories
 * @param {string} space - The space to validate against
 * @returns {Function} Express middleware
 */
const spaceValidationGate = (space) => {
  return (req, res, next) => {
    const config = SPACE_CONFIG[space];
    
    if (!config) {
      return res.status(400).json({
        success: false,
        error: `Invalid space: ${space}`,
        code: 'INVALID_SPACE'
      });
    }
    
    // Validate body length per space
    if (req.body.body && req.body.body.length > config.maxBodyLength) {
      return res.status(400).json({
        success: false,
        error: `Content too long for ${space}. Maximum ${config.maxBodyLength} characters`,
        code: 'CONTENT_TOO_LONG',
        maxLength: config.maxBodyLength,
        currentLength: req.body.body.length
      });
    }
    
    // Validate title requirement
    if (!config.allowTitle && req.body.title) {
      return res.status(400).json({
        success: false,
        error: `Titles not allowed in ${space}`,
        code: 'TITLE_NOT_ALLOWED'
      });
    }
    
    // Validate topic/category against space-specific lists
    if (req.body.topic || req.body.category) {
      const topicOrCategory = req.body.topic || req.body.category;
      const allowedList = config.topics || config.categories || [];
      
      if (allowedList.length > 0 && !allowedList.includes(topicOrCategory)) {
        return res.status(400).json({
          success: false,
          error: `Invalid ${req.body.topic ? 'topic' : 'category'} for ${space}`,
          code: 'INVALID_CATEGORY',
          allowed: allowedList,
          provided: topicOrCategory
        });
      }
    }
    
    // Validate state requirement for local space
    if (config.requiresState && !req.body.state && !req.user.state) {
      return res.status(400).json({
        success: false,
        error: 'State is required for local posts',
        code: 'STATE_REQUIRED'
      });
    }
    
    next();
  };
};

/**
 * Combined gate factory - creates a middleware stack for a specific space
 * @param {string} space - The space name
 * @returns {Function[]} Array of middleware functions
 */
const createSpaceGate = (space) => {
  const config = SPACE_CONFIG[space];
  const gates = [];
  
  // Add space validation
  gates.push(spaceValidationGate(space));
  
  // Add gender gate if required
  if (config.genderRequired) {
    gates.push(genderGate(config.genderRequired));
  }
  
  // Add state gate if space is state-restricted
  if (config.stateRestricted) {
    gates.push(stateGate(false)); // Don't enforce on reads
  }
  
  return gates;
};

/**
 * Rate limit gate - applies different limits based on space and operation
 * @param {string} space - The space name
 * @param {string} operation - 'read' or 'write'
 * @returns {Function} Express middleware
 */
const rateLimitGate = (space, operation = 'write') => {
  return (req, res, next) => {
    // Rate limiting is already handled globally in server.js
    // This gate can add space-specific limits if needed in the future
    
    // For now, just log the operation for monitoring
    req.spaceOperation = { space, operation };
    next();
  };
};

/**
 * Content moderation gate - applies space-specific content rules
 * @param {string} space - The space name
 * @returns {Function} Express middleware
 */
const moderationGate = (space) => {
  return (req, res, next) => {
    // Basic content validation (can be extended with AI moderation)
    if (req.body.body) {
      const content = req.body.body.toLowerCase();
      
      // Basic spam detection
      const spamPatterns = [
        /(.)\1{10,}/, // Repeated characters
        /https?:\/\/[^\s]+.*https?:\/\/[^\s]+.*https?:\/\/[^\s]+/, // Multiple URLs
        /\b(buy now|click here|limited time|act fast)\b/gi // Spam phrases
      ];
      
      for (const pattern of spamPatterns) {
        if (pattern.test(content)) {
          return res.status(400).json({
            success: false,
            error: 'Content appears to be spam or promotional',
            code: 'CONTENT_FLAGGED'
          });
        }
      }
    }
    
    next();
  };
};

/**
 * Logging gate - enhanced logging for space operations
 * @param {string} space - The space name
 * @returns {Function} Express middleware
 */
const loggingGate = (space) => {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Log request start
    console.log(`🎯 [${space.toUpperCase()}] ${req.method} ${req.originalUrl} - User: ${req.user?.username || 'anonymous'}`);
    
    // Override res.json to log response
    const originalJson = res.json;
    res.json = function(data) {
      const duration = Date.now() - startTime;
      const status = res.statusCode;
      const success = status < 400;
      
      console.log(`${success ? '✅' : '❌'} [${space.toUpperCase()}] ${req.method} ${req.originalUrl} - ${status} (${duration}ms)`);
      
      return originalJson.call(this, data);
    };
    
    next();
  };
};

module.exports = {
  spaceGate,
  genderGate,
  stateGate,
  spaceValidationGate,
  createSpaceGate,
  rateLimitGate,
  moderationGate,
  loggingGate,
  SPACE_CONFIG
};