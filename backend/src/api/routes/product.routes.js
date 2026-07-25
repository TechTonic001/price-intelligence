'use strict';

const { Router } = require('express');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  createListing,
  triggerScrape,
} = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/authenticate');

const router = Router();

// All product routes require authentication
router.use(authenticate);

router.get('/', getProducts);
router.post('/', authorize('ADMIN'), createProduct);
router.get('/:id', getProductById);
router.patch('/:id', authorize('ADMIN'), updateProduct);
router.delete('/:id', authorize('ADMIN'), deleteProduct);

// Listing management
router.post('/:id/listings', authorize('ADMIN'), createListing);
router.post('/listings/:listingId/scrape', triggerScrape);

module.exports = router;
