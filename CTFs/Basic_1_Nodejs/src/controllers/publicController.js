// src/controllers/publicController.js
const path = require('path');
const { Buffer } = require('buffer');
const { findUserByUsername } = require('../services/userServices');

/**
 * GET /
 * Show login page.
 */
function showLogin(req, res) {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
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
    return res.status(401).send('Invalid username or password.');
  }

  const passwordMatches = password === user.password;
  if (!passwordMatches) {
    return res.status(401).send('Invalid username or password.');
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
  if (!req.user) {
    return res.redirect('/');
  }
  const { username, role } = req.user;

  res.send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>CTF-1 – Home</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
        <link rel="stylesheet" href="/css/custom.css">
      </head>
      <body class="bg-light">
        <nav class="navbar navbar-expand-lg navbar-dark">
          <div class="container">
            <a class="navbar-brand d-flex align-items-center" href="#">
              <span class="logo-box me-2"></span>
              <span class="brand-text">CTF-1</span>
            </a>
            <div class="collapse navbar-collapse"></div>
            <div class="d-flex">
              <a class="btn btn-outline-light btn-sm me-2" href="/home">Home</a>
              <a class="btn btn-outline-light btn-sm" href="/logout">Logout</a>
            </div>
          </div>
        </nav>

        <main class="container py-5">
          <div class="row justify-content-center">
            <div class="col-md-8">
              <div class="card shadow-sm">
                <div class="card-body">
                  <h3 class="card-title">Welcome, ${username}</h3>
                  <p class="mb-1">Your role is: <strong>${role}</strong></p>
                  <p class="text-muted">This page is visible to any logged-in user.</p>
                  <p class="mt-3">Hint for students: try inspecting cookies (Application tab in DevTools).</p>
                  <p class="mt-4">
                    <a class="btn btn-primary me-2" href="/flag">Go to admin area</a>
                    <a class="btn btn-secondary" href="/logout">Logout</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
      </body>
    </html>
  `);
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
