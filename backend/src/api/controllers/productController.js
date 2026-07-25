'use strict';

const getDb = require('../../config/database');
const { enqueueScrapingJob } = require('../../queue/jobQueue');
const { createError } = require('../middleware/errorHandler');

// ─────────────────────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/products
 * Returns a paginated list of products with their active listing count.
 */
async function getProducts(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const db = getDb();
    const [products, total] = await Promise.all([
      db.product.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { merchantListings: true } },
        },
      }),
      db.product.count(),
    ]);

    res.status(200).json({
      success: true,
      data: { products, pagination: { page, limit, total, pages: Math.ceil(total / limit) } },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/products/:id
 */
async function getProductById(req, res, next) {
  try {
    const db = getDb();
    const product = await db.product.findUnique({
      where: { id: req.params.id },
      include: {
        merchantListings: {
          where: { isActive: true },
          include: {
            store: true,
            prices: {
              orderBy: { scrapedAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!product) throw createError(404, 'Product not found.', 'NOT_FOUND');

    res.status(200).json({ success: true, data: { product } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/products
 */
async function createProduct(req, res, next) {
  try {
    const { name, brand, category, imageUrl, description } = req.body;
    if (!name) throw createError(400, 'Product name is required.', 'MISSING_FIELDS');

    const db = getDb();
    const product = await db.product.create({
      data: { name, brand, category, imageUrl, description },
    });

    res.status(201).json({ success: true, data: { product } });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/products/:id
 */
async function updateProduct(req, res, next) {
  try {
    const { name, brand, category, imageUrl, description } = req.body;
    const db = getDb();
    const product = await db.product.update({
      where: { id: req.params.id },
      data: { name, brand, category, imageUrl, description },
    });
    res.status(200).json({ success: true, data: { product } });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/products/:id
 */
async function deleteProduct(req, res, next) {
  try {
    const db = getDb();
    await db.product.delete({ where: { id: req.params.id } });
    res.status(200).json({ success: true, data: { message: 'Product deleted.' } });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Merchant Listings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/products/:id/listings
 * Creates a MerchantListing that maps a store URL to this product.
 */
async function createListing(req, res, next) {
  try {
    const { storeId, url } = req.body;
    if (!storeId || !url) {
      throw createError(400, 'storeId and url are required.', 'MISSING_FIELDS');
    }

    const db = getDb();
    const listing = await db.merchantListing.create({
      data: {
        productId: req.params.id,
        storeId,
        url,
      },
      include: { store: true, product: true },
    });

    res.status(201).json({ success: true, data: { listing } });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/listings/:listingId/scrape
 * Enqueues a scraping job for a specific merchant listing.
 */
async function triggerScrape(req, res, next) {
  try {
    const { listingId } = req.params;
    const db = getDb();

    const listing = await db.merchantListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) throw createError(404, 'Listing not found.', 'NOT_FOUND');
    if (!listing.isActive) throw createError(400, 'Listing is inactive.', 'LISTING_INACTIVE');

    const jobId = await enqueueScrapingJob(listingId);

    res.status(202).json({
      success: true,
      data: { message: 'Scraping job enqueued.', jobId },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createListing,
  triggerScrape,
};
