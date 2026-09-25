const express = require('express');
const router = express.Router();
const franchiseController = require('../controllers/franchiseController');

// Public, read-only franchise data (team strip, standings, squads, logos).
router.get('/', franchiseController.list);
router.get('/:id', franchiseController.getOne);
router.get('/:id/logo', franchiseController.getLogo);

module.exports = router;
