const express = require('express');
const router = express.Router();
const playerController = require('../controllers/playerController');

// Public, read-only: spectators can browse players, rankings and profiles.
router.get('/', playerController.getAllPlayers);
router.get('/rankings', playerController.getRankings);
router.get('/:id', playerController.getPlayerById);

module.exports = router;
