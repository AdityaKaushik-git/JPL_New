const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware, adminMiddleware);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/auction/state', adminController.getAuctionState);
router.post('/auction/request-start-otp', adminController.requestStartAuctionOtp);
router.post('/auction/verify-start-otp', adminController.verifyStartAuctionOtp);

// Franchises (team owners). Purse and squad limits are fixed by the server.
router.get('/franchises', adminController.getFranchises);
router.post('/franchises', adminController.createFranchise);
router.delete('/franchises/all', adminController.deleteAllBidders);
router.put('/franchises/:id', adminController.updateFranchise);
router.patch('/franchises/:id/status', adminController.setFranchiseStatus);
router.patch('/franchises/:id/password', adminController.resetFranchisePassword);

// Players (no photos)
router.get('/players', adminController.getPlayers);
router.post('/players', adminController.addPlayer);
router.put('/players/:id', adminController.updatePlayer);
router.patch('/players/:id/status', adminController.updatePlayerStatus);
router.delete('/players/:id', adminController.deletePlayer);
router.post('/players/:id/matches', adminController.addPlayerMatch);
router.delete('/players/:id/matches/:matchId', adminController.deletePlayerMatch);

// Rankings
router.post('/rankings/recalculate', adminController.recalculateRankings);

// History
router.get('/auction-history', adminController.getAuctionHistory);
router.delete('/auction-history/:id', adminController.deleteAuctionHistoryRecord);

module.exports = router;
