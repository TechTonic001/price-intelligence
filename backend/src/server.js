'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { startBoss } = require('./config/pgboss');
const { registerScraperWorker } = require('./workers/scraperWorker');
const { errorHandler } = require('./api/middleware/errorHandler');

// Routes
const authRoutes = require('./api/routes/auth.routes');
const productRoutes = require('./api/routes/product.routes');
const priceRoutes = require('./api/routes/price.routes');

const app = express();
const PORT = process.env.PORT || 4000;

// ─────────────────────────────────────────────────────────────────────────────
// Global Middleware
// ─────────────────────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // Required for HTTP-only cookies to be sent cross-origin
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Parses req.cookies — required for refresh token

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    },
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api', priceRoutes);

// ── 404 Handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found.` },
  });
});

// ── Global Error Handler (must be last) ──────────────────────────────────────
// All errors thrown or passed via next(err) route through here.
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Server Startup
// ─────────────────────────────────────────────────────────────────────────────

async function start() {
  try {
    // Start the pg-boss job queue scheduler
    await startBoss();

    // Register the Puppeteer scraper as a queue consumer
    await registerScraperWorker();

    app.listen(PORT, () => {
      console.log(`\n🚀 Price Intelligence API running on http://localhost:${PORT}`);
      console.log(`   Environment : ${process.env.NODE_ENV}`);
      console.log(`   Health check: http://localhost:${PORT}/health\n`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app; // Export for testing
