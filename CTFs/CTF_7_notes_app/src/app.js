const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const profileDeserializer = require('./middleware/profileDeserializer');
const syncFlagFiles = require('./services/flagSync');

const app = express();
const PORT = process.env.PORT || 3001;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Vulnerable deserialization middleware (applied globally)
app.use(profileDeserializer);

// Static files (public/ directory only)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Copy package.json to public/ for Chain C breadcrumb
const pkgSrc = path.join(__dirname, '..', 'package.json');
const pkgDest = path.join(__dirname, '..', 'public', 'package.json');
try {
  fs.copyFileSync(pkgSrc, pkgDest);
} catch (err) {
  console.error('[startup] Could not copy package.json to public/:', err.message);
}

// Sync flag files on startup
syncFlagFiles();

// Routes
app.use(require('./routes/auth'));
app.use(require('./routes/home'));
app.use(require('./routes/notes'));
app.use(require('./routes/debug'));
app.use(require('./routes/about'));

// Only start listening when not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`NorthSide Notes running on http://localhost:${PORT}`);
  });
}

module.exports = app;
