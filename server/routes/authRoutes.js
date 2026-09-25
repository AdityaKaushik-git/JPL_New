const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

// Public registration has been removed. Franchises are created by the admin only.
router.post('/login', loginLimiter, authController.login);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
