const express = require('express');
const router = express.Router();
const OfferController = require('../controllers/OfferController');
const { authenticateToken } = require('../middlewares/auth.middleware');
const { authorizeRoles } = require('../middlewares/auth.middleware');

/**
 * @route POST /api/offers
 * @desc Create a new offer
 * @access Admin
 */
router.post('/', authenticateToken, authorizeRoles('admin'), OfferController.createOffer);

/**
 * @route GET /api/offers
 * @desc Get all offers
 * @access Public
 */
router.get('/', OfferController.getAllOffers);

/**
 * @route GET /api/offers/admin
 * @desc Get all offers for admin (no date restrictions)
 * @access Private/Admin
 */
router.get('/admin', authenticateToken, authorizeRoles('admin'), OfferController.getAllOffersAdmin);

/**
 * @route GET /api/offers/:id
 * @desc Get offer by ID
 * @access Public
 */
router.get('/:id', OfferController.getOfferById);

/**
 * @route PUT /api/offers/:id
 * @desc Update offer
 * @access Admin
 */
router.put('/:id', authenticateToken, authorizeRoles('admin'), OfferController.updateOffer);

/**
 * @route DELETE /api/offers/:id
 * @desc Delete offer
 * @access Admin
 */
router.delete('/:id', authenticateToken, authorizeRoles('admin'), OfferController.deleteOffer);

/**
 * @route POST /api/offers/validate
 * @desc Validate offer code
 * @access Public
 */
router.post('/validate', OfferController.validateOffer);

module.exports = router;