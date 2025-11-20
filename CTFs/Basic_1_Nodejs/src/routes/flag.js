// src/routes/flag.js
const express = require('express');
const router = express.Router();

const authCookie = require('../middleware/authCookie');
const flagController = require('../controllers/flagController');

// /flag – requires admin role in the (insecure) cookie
router.get('/', authCookie, flagController.getFlag);

module.exports = router;
