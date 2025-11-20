// src/middleware/authCookie.js
const { Buffer } = require('buffer');

/**
 * Reads the 'session' cookie, if present, and attaches it to req.user.
 * Does NOT verify or sign anything (INTENTIONALLY INSECURE).
 */
function authCookie(req, res, next) {
  const raw = req.cookies && req.cookies.session;

  if (!raw) {
    req.user = null;
    return next();
  }

  try {
    const decodedJson = Buffer.from(raw, 'base64').toString('utf8');
    const session = JSON.parse(decodedJson);
    req.user = session;
  } catch (err) {
    console.error('Failed to parse session cookie:', err);
    req.user = null;
  }

  return next();
}

module.exports = authCookie;
