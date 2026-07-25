'use strict';

const getDb = require('../../config/database');
const { createError } = require('../middleware/errorHandler');

/**
 * GET /api/listings/:listingId/prices
 * Returns the paginated price history for a merchant listing,
 * ordered newest-first (append-only — no records are ever updated).
 */
async function getPriceHistory(req, res, next) {
  try {
    const { listingId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(500, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const db = getDb();

    // Verify the listing exists before querying prices
    const listingExists = await db.merchantListing.findUnique({
      where: { id: listingId },
      select: { id: true, url: true, product: { select: { name: true } }, store: { select: { name: true } } },
    });

    if (!listingExists) throw createError(404, 'Listing not found.', 'NOT_FOUND');

    const [prices, total] = await Promise.all([
      db.price.findMany({
        where: { listingId },
        orderBy: { scrapedAt: 'desc' },
        skip,
        take: limit,
      }),
      db.price.count({ where: { listingId } }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        listing: listingExists,
        prices,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/listings/:listingId/prices/latest
 * Returns the most recently scraped price for a listing.
 */
async function getLatestPrice(req, res, next) {
  try {
    const { listingId } = req.params;
    const db = getDb();

    const price = await db.price.findFirst({
      where: { listingId },
      orderBy: { scrapedAt: 'desc' },
    });

    if (!price) throw createError(404, 'No price data found for this listing.', 'NOT_FOUND');

    res.status(200).json({ success: true, data: { price } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/products/:productId/price-comparison
 * Compares the latest price across all active listings for a product.
 * Useful for showing a price comparison table on the product detail page.
 */
async function getPriceComparison(req, res, next) {
  try {
    const { productId } = req.params;
    const db = getDb();

    const listings = await db.merchantListing.findMany({
      where: { productId, isActive: true },
      include: {
        store: true,
        prices: {
          orderBy: { scrapedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!listings.length) {
      throw createError(404, 'No active listings found for this product.', 'NOT_FOUND');
    }

    // Flatten into a comparable shape
    const comparison = listings.map((l) => ({
      listingId: l.id,
      url: l.url,
      store: l.store,
      latestPrice: l.prices[0] || null,
    }));

    // Sort cheapest first
    comparison.sort((a, b) => {
      if (!a.latestPrice) return 1;
      if (!b.latestPrice) return -1;
      return parseFloat(a.latestPrice.price) - parseFloat(b.latestPrice.price);
    });

    res.status(200).json({ success: true, data: { comparison } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPriceHistory, getLatestPrice, getPriceComparison };
