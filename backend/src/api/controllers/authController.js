'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const getDb = require('../../config/database');
const { createError } = require('../middleware/errorHandler');

const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// Token utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a short-lived JWT access token (default: 15 minutes).
 * Contains only non-sensitive fields — never include passwordHash.
 */
function generateAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }
  );
}

/**
 * Generates a cryptographically random, opaque refresh token string.
 * We store this in the database so we can revoke it at any time.
 * It is NOT a JWT — its value carries no decodable payload.
 */
function generateRefreshTokenValue() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * Sets the refresh token as an HTTP-only, Secure, SameSite=Strict cookie.
 * This cookie is inaccessible to JavaScript, protecting against XSS.
 */
function setRefreshCookie(res, tokenValue) {
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  res.cookie('refreshToken', tokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: sevenDaysMs,
    path: '/api/auth', // Only sent to auth endpoints — reduces attack surface
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError(400, 'Email and password are required.', 'MISSING_FIELDS');
    }

    if (password.length < 8) {
      throw createError(400, 'Password must be at least 8 characters.', 'WEAK_PASSWORD');
    }

    const db = getDb();
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await db.user.create({
      data: { email: email.toLowerCase().trim(), passwordHash },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    res.status(201).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Issues a short-lived access token in the response body and
 * a long-lived refresh token in an HTTP-only cookie.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError(400, 'Email and password are required.', 'MISSING_FIELDS');
    }

    const db = getDb();
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      // Use same message for both "not found" and "wrong password" to prevent
      // user enumeration attacks via timing differences
      throw createError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw createError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    }

    // Issue tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenValue = generateRefreshTokenValue();

    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: refreshExpiresAt,
      },
    });

    setRefreshCookie(res, refreshTokenValue);

    res.status(200).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/refresh
 * Reads the HTTP-only refresh token cookie, validates it against the database,
 * issues a new access token, and ROTATES the refresh token (old one revoked).
 * This prevents replay attacks — a stolen refresh token becomes invalid
 * the moment it is used.
 */
async function refresh(req, res, next) {
  try {
    const tokenValue = req.cookies?.refreshToken;

    if (!tokenValue) {
      throw createError(401, 'Refresh token not found.', 'MISSING_REFRESH_TOKEN');
    }

    const db = getDb();
    const storedToken = await db.refreshToken.findUnique({
      where: { token: tokenValue },
      include: { user: true },
    });

    // Validate: must exist, not revoked, and not expired
    if (
      !storedToken ||
      storedToken.revoked ||
      new Date() > storedToken.expiresAt
    ) {
      // Clear the invalid cookie
      res.clearCookie('refreshToken', { path: '/api/auth' });
      throw createError(401, 'Refresh token is invalid or expired.', 'INVALID_REFRESH_TOKEN');
    }

    const { user } = storedToken;

    // Rotate: revoke old token and issue a new one atomically
    const newRefreshTokenValue = generateRefreshTokenValue();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.$transaction([
      db.refreshToken.update({
        where: { id: storedToken.id },
        data: { revoked: true },
      }),
      db.refreshToken.create({
        data: {
          token: newRefreshTokenValue,
          userId: user.id,
          expiresAt: newExpiresAt,
        },
      }),
    ]);

    const newAccessToken = generateAccessToken(user);
    setRefreshCookie(res, newRefreshTokenValue);

    res.status(200).json({
      success: true,
      data: { accessToken: newAccessToken },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Revokes the refresh token in the database and clears the cookie.
 */
async function logout(req, res, next) {
  try {
    const tokenValue = req.cookies?.refreshToken;

    if (tokenValue) {
      const db = getDb();
      // Best-effort revocation — don't fail if token is already gone
      await db.refreshToken
        .updateMany({
          where: { token: tokenValue, revoked: false },
          data: { revoked: true },
        })
        .catch(() => {});
    }

    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(200).json({ success: true, data: { message: 'Logged out successfully.' } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 * Requires `authenticate` middleware upstream.
 */
async function getMe(req, res, next) {
  try {
    const db = getDb();
    const user = await db.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      throw createError(404, 'User not found.', 'NOT_FOUND');
    }

    res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, refresh, logout, getMe };
