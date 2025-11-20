// src/routes/debug.js
const express = require('express');
const router = express.Router();

const authInsecure = require('../middleware/authInsecure');
const debugController = require('../controllers/debugController');

// All /debug routes require "admin" via authInsecure
router.get('/', authInsecure, debugController.info);

module.exports = router;
