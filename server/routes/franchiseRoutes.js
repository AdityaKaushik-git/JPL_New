const express = require('express');
const router = express.Router();
const franchiseController = require('../controllers/franchiseController');
const { optionalAuth } = require('../middleware/auth');

// Franchise endpoints
router.get('/', franchiseController.list);
router.get('/:id', optionalAuth, (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.id === Number(req.params.id))) {
        return franchiseController.getOne(req, res, next);
    }
    return res.status(403).json({ message: 'Franchise details are confidential and accessible only to admins' });
});
router.get('/:id/logo', franchiseController.getLogo);

module.exports = router;
