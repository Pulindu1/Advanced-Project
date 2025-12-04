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

  // Debug: log the raw session cookie we received
  try {
    console.log('[authCookie] raw session cookie:', raw);
  } catch (e) {
    console.log('[authCookie] failed to log raw cookie');
  }

  try {
    // Try several decoding strategies to be resilient during debugging:
    let decodedJson;
    let parsed = null;

    // 1) assume base64(JSON)
    try {
      decodedJson = Buffer.from(raw, 'base64').toString('utf8');
      parsed = JSON.parse(decodedJson);
      console.log('[authCookie] parsed session (base64->json)');
    } catch (e1) {
      // 2) maybe raw JSON was pasted into cookie
      try {
        parsed = JSON.parse(raw);
        console.log('[authCookie] parsed session (raw JSON)');
      } catch (e2) {
        // 3) maybe URL-encoded base64
        try {
          const decodedURIComponent = decodeURIComponent(raw);
          try {
            decodedJson = Buffer.from(decodedURIComponent, 'base64').toString('utf8');
            parsed = JSON.parse(decodedJson);
            console.log('[authCookie] parsed session (decodeURIComponent -> base64 -> json)');
          } catch (e3) {
            // 4) maybe raw JSON after decodeURIComponent
            parsed = JSON.parse(decodedURIComponent);
            console.log('[authCookie] parsed session (decodeURIComponent -> raw JSON)');
          }
        } catch (e4) {
          // give up below
        }
      }
    }

    if (parsed) {
      req.user = parsed;
    } else {
      throw new Error('Unable to parse session cookie with any supported format');
    }
  } catch (err) {
    console.error('Failed to parse session cookie:', err);
    req.user = null;
  }

  return next();
}

module.exports = authCookie;
