'use strict';

/**
 * Centralized Express error-handling middleware.
 *
 * This MUST be the last middleware registered with app.use() in server.js.
 * All errors thrown or passed via next(err) anywhere in the application
 * flow through here — it is the single source of truth for error responses.
 *
 * Security contract:
 *   - Raw Prisma error details (codes, meta) are NEVER sent to the client.
 *   - Stack traces are only included in development mode.
 *   - All responses share a consistent { success, error } shape.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';

  // Log the full error server-side regardless of environment
  console.error('[ErrorHandler]', {
    message: err.message,
    code: err.code,
    path: req.path,
    method: req.method,
    stack: isDev ? err.stack : undefined,
  });

  // ── Prisma-specific errors ──────────────────────────────────────────────
  // P2002 = Unique constraint failed (e.g. duplicate email on register)
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: 'A record with that value already exists.',
      },
    });
  }

  // P2025 = Record not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  }

  // ── Operational errors with explicit status codes ──────────────────────
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode || 'REQUEST_ERROR',
        message: err.message,
      },
    });
  }

  // ── Validation errors ─────────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
      },
    });
  }

  // ── Fallback: unknown/internal server error ────────────────────────────
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      // Never leak raw error messages to the client in production
      message: isDev ? err.message : 'An unexpected error occurred.',
      ...(isDev && { stack: err.stack }),
    },
  });
}

/**
 * Creates an operational error with a status code.
 * Use this to signal expected error conditions without
 * exposing internals (e.g., throw createError(400, 'Invalid input')).
 */
function createError(statusCode, message, errorCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.errorCode = errorCode || 'REQUEST_ERROR';
  return err;
}

module.exports = { errorHandler, createError };
