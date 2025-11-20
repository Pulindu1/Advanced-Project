// src/routes/index.js
const express = require('express');
const router = express.Router();

// Sub-routers
const publicRoutes = require('./public');
const debugRoutes = require('./debug');
const flagRoutes = require('./flag');

router.use('/', publicRoutes);
router.use('/debug', debugRoutes);
router.use('/flag', flagRoutes);

module.exports = router;
