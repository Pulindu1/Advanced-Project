// src/routes/public.js
const express = require('express');
const router = express.Router();

const publicController = require('../controllers/publicController');
const authCookie = require('../middleware/authCookie');
const loginRateLimiter = require('../middleware/loginRateLimiter');

// Show login page
router.get('/', publicController.showLogin);

// Handle login form submission (apply rate limiter to prevent brute force)
router.post('/login', loginRateLimiter, publicController.handleLogin);

// Home page (requires a session cookie, but any role)
router.get('/home', authCookie, publicController.home);

// Debug helper: show parsed session (for instructors/dev only)
router.get('/whoami', authCookie, (req, res) => {
	res.json({ user: req.user || null, cookies: req.cookies || null });
});

// Logout
router.get('/logout', publicController.logout);

module.exports = router;
