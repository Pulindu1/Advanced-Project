// src/controllers/debugController.js

/**
 * Only "admins" (with the magic header) can see this.
 * Good place to leak small hints or partial info.
 */
function info(req, res) {
  res.json({
    message: 'Welcome to the debug panel (admin only).',
    user: req.user,
    hint: 'Insecure auth trusts the X-Admin HTTP header too much...'
  });
}

module.exports = {
  info
};
