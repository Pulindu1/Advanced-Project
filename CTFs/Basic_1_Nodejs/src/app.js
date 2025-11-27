// src/app.js
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// View engine setup (EJS templates)
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Parse JSON / form bodies
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Parse cookies
app.use(cookieParser());

// Simple request logger
app.use(logger);
// Routes (rendered views will take precedence)
app.use('/', routes);

// Static files (e.g. public assets)
app.use(express.static(path.join(__dirname, 'public')));

// Error handler (keep last)
app.use(errorHandler);

module.exports = app;
