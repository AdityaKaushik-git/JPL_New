const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware, franchiseMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/dashboard', userController.getDashboard);
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.get('/standings', userController.getStandings);

router.get('/my-team', franchiseMiddleware, userController.getTeam);
router.get('/my-bids', franchiseMiddleware, userController.getBids);

// Legacy aliases
router.get('/team', franchiseMiddleware, userController.getTeam);
router.get('/bids', franchiseMiddleware, userController.getBids);
router.get('/player-profile', userController.getPlayerProfile);
router.put('/player-profile', userController.updatePlayerProfile);

module.exports = router;
