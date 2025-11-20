// src/middleware/authInsecure.js

/**
 * Intentionally insecure "auth" middleware.
 *
 * If the request includes header: X-Admin: true
 * we blindly treat the user as an admin.
 *
 * Real systems must NEVER trust client-controlled headers like this.
 */
function authInsecure(req, res, next) {
  const adminHeader = req.headers['x-admin'];

  if (adminHeader && adminHeader.toString().toLowerCase() === 'true') {
    // Magic backdoor: become admin just by setting the header
    req.user = {
      username: 'header-admin',
      role: 'admin',
      via: 'X-Admin header'
    };
    return next();
  }

  // Everyone else is a guest and blocked from admin-only routes
  req.user = {
    username: 'guest',
    role: 'guest'
  };

  return res.status(403).send(`
    <h1>Access denied</h1>
    <p>This area is for admins only.</p>
    <p>(For your dissertation write-up: this 403 is expected without the exploit.)</p>
  `);
}

module.exports = authInsecure;
