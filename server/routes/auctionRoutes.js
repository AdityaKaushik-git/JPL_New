const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');

// Public: spectators can see the live state and the full auction history.
router.get('/status', auctionController.getStatus);
router.get('/history', auctionController.getHistory);

module.exports = router;
