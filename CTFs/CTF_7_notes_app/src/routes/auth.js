const express = require('express');
const fs = require('fs');
const path = require('path');
const serialize = require('node-serialize');
const loginRateLimiter = require('../middleware/loginRateLimiter');

const router = express.Router();

const USERS_PATH = path.join(__dirname, '..', 'data', 'users.json');

function loadUsers() {
  return JSON.parse(fs.readFileSync(USERS_PATH, 'utf8'));
}

router.get('/', (req, res) => {
  if (req.userProfile && req.userProfile.username) {
    return res.redirect('/home');
  }
  res.render('index', { error: null });
});

router.post('/login', loginRateLimiter, (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(401).render('index', { error: 'Username and password are required.' });
  }

  const users = loadUsers();
  const user = users[username];

  if (!user || user.password !== password) {
    return res.status(401).render('index', { error: 'Invalid username or password.' });
  }

  const profile = {
    username: username,
    theme: 'light',
    lastVisit: new Date().toISOString(),
  };

  const serialized = serialize.serialize(profile);
  const encoded = Buffer.from(serialized).toString('base64');

  res.cookie('profile', encoded, {
    httpOnly: false,
    path: '/',
  });

  res.redirect('/home');
});

router.get('/logout', (req, res) => {
  res.clearCookie('profile');
  res.redirect('/');
});

module.exports = router;
