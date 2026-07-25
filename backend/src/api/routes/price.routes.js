'use strict';

const { Router } = require('express');
const { getPriceHistory, getLatestPrice, getPriceComparison } = require('../controllers/priceController');
const { authenticate } = require('../middleware/authenticate');

const router = Router();

router.use(authenticate);

// Price history for a specific listing
router.get('/listings/:listingId/prices', getPriceHistory);
router.get('/listings/:listingId/prices/latest', getLatestPrice);

// Cross-store price comparison for a product
router.get('/products/:productId/price-comparison', getPriceComparison);

module.exports = router;
