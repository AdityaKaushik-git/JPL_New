const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, adminMiddleware, franchiseMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/dashboard', userController.getDashboard);
router.get('/profile', userController.getProfile);
router.get('/standings', (req, res, next) => {
    if (req.user && req.user.role === 'admin') return next();
    const auctionSocket = require('../sockets/auctionSocket');
    if (auctionSocket.getShowLiveRankings && auctionSocket.getShowLiveRankings()) return next();
    return res.status(403).json({ message: 'Auction results have not been declared yet.' });
}, userController.getStandings);

router.get('/my-team', franchiseMiddleware, userController.getTeam);
router.get('/my-bids', franchiseMiddleware, userController.getBids);

// Legacy aliases
router.get('/team', franchiseMiddleware, userController.getTeam);
router.get('/bids', franchiseMiddleware, userController.getBids);
router.get('/player-profile', userController.getPlayerProfile);
router.put('/player-profile', userController.updatePlayerProfile);

module.exports = router;
