// src/app.js
const express = require('express');
const path = require('path');

const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Parse JSON / form bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple request logger
app.use(logger);

// Static files (e.g. public/index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', routes);

// Error handler (keep last)
app.use(errorHandler);

module.exports = app;
