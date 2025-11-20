// src/routes/index.js
const express = require('express');
const router = express.Router();

// Sub-routers
const publicRoutes = require('./public');
const flagRoutes = require('./flag');

router.use('/', publicRoutes);
router.use('/flag', flagRoutes);

module.exports = router;
