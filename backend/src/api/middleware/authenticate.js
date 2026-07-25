'use strict';

const jwt = require('jsonwebtoken');

/**
 * Express middleware that verifies a JWT access token from the
 * Authorization: Bearer <token> header.
 *
 * On success: attaches the decoded payload to `req.user` and calls `next()`.
 * On token expiry: responds 401 with code "TOKEN_EXPIRED" — the React
 *   frontend intercepts this flag to silently call /api/auth/refresh.
 * On all other auth failures: responds 401 with code "UNAUTHORIZED".
 *
 * NEVER exposes the raw JWT error or stack trace to the client.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token is required.',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // The React apiClient interceptor listens for this exact code
      // and will silently call POST /api/auth/refresh to rotate tokens.
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Access token has expired. Please refresh.',
        },
      });
    }

    // Invalid signature, malformed token, etc.
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or malformed authentication token.',
      },
    });
  }
}

/**
 * Role-based authorization middleware factory.
 * Usage: router.get('/admin', authenticate, authorize('ADMIN'), handler)
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource.',
        },
      });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
