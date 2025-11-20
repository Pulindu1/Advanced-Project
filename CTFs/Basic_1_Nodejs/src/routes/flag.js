// src/routes/flag.js
const express = require('express');
const router = express.Router();

const authInsecure = require('../middleware/authInsecure');
const flagController = require('../controllers/flagController');

// Only admins (via vulnerable auth) can reach this route
router.get('/', authInsecure, flagController.getFlag);

module.exports = router;
