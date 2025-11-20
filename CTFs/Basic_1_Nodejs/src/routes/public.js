// src/routes/public.js
const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Home page (basic explanation)
router.get('/', publicController.home);

// Simple "status" JSON route (handy for testing)
router.get('/status', publicController.status);

module.exports = router;
