// src/controllers/publicController.js
const path = require('path');
const { Buffer } = require('buffer');
const { findUserByUsername } = require('../services/userServices');

/**
 * GET /
 * Show login page.
 */
function showLogin(req, res) {
  // Render login page via template
  return res.render('index');
}

/**
 * POST /login
 *
 * Authenticates a user and drops an intentionally insecure cookie so
 * students can practice privilege escalation in later steps.
 */
function handleLogin(req, res) {
  const { username, password } = req.body;

  const user = findUserByUsername(username);

  if (!user) {
    // Render login with an error message so the user sees a styled alert
    return res.status(401).render('index', { error: 'Invalid username or password.' });
  }

  const passwordMatches = password === user.password;
  if (!passwordMatches) {
    return res.status(401).render('index', { error: 'Invalid username or password.' });
  }

  // Create session object (INTENTIONALLY UNSIGNED / UNENCRYPTED)
  const session = {
    username: user.username,
    role: user.role
  };

  const encoded = Buffer.from(JSON.stringify(session)).toString('base64');

  // httpOnly: false so students can see/edit it in DevTools
  res.cookie('session', encoded, {
    httpOnly: false
  });

  return res.redirect('/home');
}

/**
 * GET /home
 * Shows basic user info from the (insecure) cookie.
 */
function home(req, res) {
  if (!req.user) return res.redirect('/');
  const { username, role } = req.user;
  return res.render('home', { username, role });
}

/**
 * GET /logout
 * Clear cookie and go back to login.
 */
function logout(req, res) {
  res.clearCookie('session');
  res.redirect('/');
}

module.exports = {
  showLogin,
  handleLogin,
  home,
  logout
};
