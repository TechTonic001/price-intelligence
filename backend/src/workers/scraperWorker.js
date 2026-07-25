'use strict';

/**
 * Puppeteer Scraper Worker
 *
 * Consumes 'scrape-listing' jobs from pg-boss and extracts price data
 * from a merchant listing's URL.
 *
 * ── Resilience Contract ──────────────────────────────────────────────────────
 *
 * 1. ALL page interactions are wrapped in try/catch.
 * 2. If a CSS selector is missing or page.evaluate() throws:
 *      - A structured error is logged (never crashes the Node process)
 *      - The job is marked as FAILED in pg-boss → auto-retried with backoff
 * 3. browser.close() is called in a `finally` block — runs unconditionally
 *    even on error, preventing zombie Chromium processes and memory leaks.
 *
 * ── Adding Store-Specific Selectors ─────────────────────────────────────────
 *
 * Add a new entry to STORE_SELECTORS mapping the store's domain to CSS
 * selectors for the price and stock status elements. The worker will
 * automatically pick the correct strategy based on the listing's URL.
 */

const puppeteer = require('puppeteer');
const getDb = require('../config/database');
const { getBoss } = require('../config/pgboss');
const { SCRAPE_JOB_NAME } = require('../queue/jobQueue');

// ─────────────────────────────────────────────────────────────────────────────
// Store-specific scraping strategies
// Add new stores here by mapping domain → { priceSelector, stockSelector }
// ─────────────────────────────────────────────────────────────────────────────

const STORE_SELECTORS = {
  'amazon.com': {
    priceSelector: '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    stockSelector: '#availability .a-color-success',
    currency: 'USD',
  },
  'amazon.co.uk': {
    priceSelector: '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    stockSelector: '#availability .a-color-success',
    currency: 'GBP',
  },
  'ebay.com': {
    priceSelector: '.x-price-primary span[itemprop="price"]',
    stockSelector: '.d-quantity__select',
    currency: 'USD',
  },
  // ── Default fallback ──────────────────────────────────────────────────────
  // Uses common schema.org microdata if available
  default: {
    priceSelector: '[itemprop="price"], .price, .product-price',
    stockSelector: '[itemprop="availability"]',
    currency: 'USD',
  },
};

/**
 * Determines the scraping strategy for a given URL by matching its hostname
 * against the STORE_SELECTORS map.
 */
function getSelectorStrategy(url) {
  try {
    const { hostname } = new URL(url);
    const match = Object.keys(STORE_SELECTORS).find((domain) =>
      hostname.includes(domain)
    );
    return STORE_SELECTORS[match] || STORE_SELECTORS.default;
  } catch {
    return STORE_SELECTORS.default;
  }
}

/**
 * Cleans a raw price string (e.g. "$1,299.99" → 1299.99).
 * Returns null if the value cannot be parsed as a number.
 */
function parsePrice(rawPrice) {
  if (!rawPrice) return null;
  const cleaned = rawPrice.replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  return isNaN(value) ? null : value;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core scraper function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scrapes the price of a merchant listing and saves it to the Price table.
 *
 * @param {object} job - The pg-boss job object { id, data: { listingId } }
 */
async function processScrapingJob(job) {
  const { listingId } = job.data;
  const db = getDb();
  let browser = null;

  console.log(`[Scraper] Starting job for listingId: ${listingId}`);

  // ── Phase 1: Fetch listing from database ──────────────────────────────────
  let listing;
  try {
    listing = await db.merchantListing.findUnique({
      where: { id: listingId },
      include: { store: true },
    });

    if (!listing) {
      throw new Error(`Listing ${listingId} not found in database.`);
    }

    if (!listing.isActive) {
      console.log(`[Scraper] Listing ${listingId} is inactive. Skipping.`);
      return; // pg-boss marks job as completed (no retry needed)
    }
  } catch (dbErr) {
    console.error(`[Scraper] DB error fetching listing ${listingId}:`, {
      message: dbErr.message,
      listingId,
    });
    throw dbErr; // Re-throw so pg-boss marks as failed → auto-retry
  }

  // ── Phase 2: Launch browser ───────────────────────────────────────────────
  try {
    browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode (more stable)
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Prevent crashes on low-memory servers
        '--disable-gpu',
      ],
    });
  } catch (launchErr) {
    console.error(`[Scraper] Failed to launch browser for listing ${listingId}:`, {
      message: launchErr.message,
    });
    throw launchErr; // Re-throw → pg-boss retries
  }

  // ── Phase 3: Navigate & extract price ────────────────────────────────────
  // The `finally` block below GUARANTEES browser.close() runs even if
  // this phase throws, preventing zombie Chromium processes.
  try {
    const page = await browser.newPage();

    // Set a realistic user agent to reduce bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Abort image and font requests to speed up scraping
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });

    console.log(`[Scraper] Navigating to ${listing.url}`);
    await page.goto(listing.url, {
      waitUntil: 'domcontentloaded',
      timeout: 30000, // 30 second page load timeout
    });

    const strategy = getSelectorStrategy(listing.url);
    console.log(`[Scraper] Using selector strategy for: ${listing.store?.domain || 'default'}`);

    // ── Price extraction — wrapped in its own try/catch ───────────────────
    // If the selector is missing or the DOM structure changed, we log a
    // structured error and throw so pg-boss can retry rather than saving
    // a null/invalid price to the database.
    let rawPrice;
    try {
      rawPrice = await page.$eval(strategy.priceSelector, (el) => el.textContent.trim());
    } catch (selectorErr) {
      // Selector miss: log structured error — do NOT crash the process
      console.error(`[Scraper] Price selector not found for listing ${listingId}:`, {
        url: listing.url,
        selector: strategy.priceSelector,
        error: selectorErr.message,
        listingId,
        storeId: listing.storeId,
      });
      throw new Error(`Price selector "${strategy.priceSelector}" not found on page.`);
    }

    // ── Stock status (optional — graceful fallback) ───────────────────────
    let inStock = true;
    try {
      const stockText = await page.$eval(
        strategy.stockSelector,
        (el) => el.textContent.trim().toLowerCase()
      );
      inStock = stockText.includes('in stock') || stockText.includes('available');
    } catch {
      // Stock selector is not critical — default to true if missing
      console.warn(`[Scraper] Stock selector not found for listing ${listingId}. Defaulting to inStock=true.`);
    }

    const price = parsePrice(rawPrice);

    if (price === null || price <= 0) {
      throw new Error(
        `Could not parse a valid price from raw value: "${rawPrice}" for listing ${listingId}`
      );
    }

    // ── Phase 4: Persist the price (append-only) ──────────────────────────
    const saved = await db.price.create({
      data: {
        listingId,
        price,
        currency: strategy.currency,
        inStock,
      },
    });

    console.log(
      `[Scraper] ✓ Saved price for listing ${listingId}: ${strategy.currency} ${price} (inStock: ${inStock}) → priceId: ${saved.id}`
    );

  } finally {
    // ── CRITICAL: Always close the browser, even if an error was thrown ──
    // This prevents zombie Chromium processes from accumulating.
    if (browser) {
      try {
        await browser.close();
        console.log(`[Scraper] Browser closed for listing ${listingId}`);
      } catch (closeErr) {
        console.error(`[Scraper] Error closing browser for listing ${listingId}:`, closeErr.message);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registers this module as a pg-boss worker for the 'scrape-listing' queue.
 * Call this once during server startup (after startBoss()).
 */
async function registerScraperWorker() {
  const boss = getBoss();

  await boss.work(SCRAPE_JOB_NAME, { batchSize: 2, pollingIntervalSeconds: 5 }, async (jobs) => {
    for (const job of jobs) {
      try {
        await processScrapingJob(job);
      } catch (err) {
        console.error(`[Scraper] Job ${job.id} failed:`, { message: err.message, listingId: job.data.listingId });
        throw err;
      }
    }
  });

  console.log(`[Scraper] Worker registered for queue: "${SCRAPE_JOB_NAME}"`);
}

module.exports = { registerScraperWorker };
