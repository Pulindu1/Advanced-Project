// src/routes/public.js
const express = require('express');
const router = express.Router();

const publicController = require('../controllers/publicController');
const authCookie = require('../middleware/authCookie');

// Show login page
router.get('/', publicController.showLogin);

// Handle login form submission
router.post('/login', publicController.handleLogin);

// Home page (requires a session cookie, but any role)
router.get('/home', authCookie, publicController.home);

// Logout
router.get('/logout', publicController.logout);

module.exports = router;
