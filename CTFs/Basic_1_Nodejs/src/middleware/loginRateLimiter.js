// src/middleware/loginRateLimiter.js
// Simple in-memory per-IP login rate limiter with lockout window.
// - Allows MAX_ATTEMPTS failed login attempts within WINDOW_MS
// - If exceeded, locks the IP for LOCKOUT_MS
// - Lock state is stored on the server; refreshing the page does not reset it

const failuresByIp = new Map();

// Configuration -- adjust as needed
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function now() { return Date.now(); }

function pruneOldFailures(record) {
  const cutoff = now() - WINDOW_MS;
  record.failures = record.failures.filter(ts => ts > cutoff);
}

// Middleware
function loginRateLimiter(req, res, next) {
  // Only apply to POST /login (we'll still guard in routes when used)
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  let record = failuresByIp.get(ip);
  const n = now();

  if (record && record.lockedUntil && n < record.lockedUntil) {
    const retryInMs = record.lockedUntil - n;
    const retrySec = Math.ceil(retryInMs / 1000);
    // Send a styled HTML response so the lockout page uses site styling
    // Render the lockout page using the template
    return res.status(429).render('lockout', { retrySec });
  }

  if (!record) {
    record = { failures: [], lockedUntil: null };
    failuresByIp.set(ip, record);
  }

  // After response finishes, update failure count or clear on success.
  res.on('finish', () => {
    // Only consider POST requests (this middleware should be mounted only on POST /login)
    if (req.method !== 'POST') return;

    // Consider status codes: 401/403 as failed login; 302/200 as success
    const status = res.statusCode;

    if (status === 401 || status === 403) {
      // record a failure timestamp
      record.failures.push(now());
      pruneOldFailures(record);

      if (record.failures.length >= MAX_ATTEMPTS) {
        record.lockedUntil = now() + LOCKOUT_MS;
      }
    } else if (status === 302 || status === 200) {
      // successful login or redirect - clear failures for this IP
      record.failures = [];
      record.lockedUntil = null;
    }
  });

  return next();
}

// Periodic cleanup: remove IP records that are idle (no failures and not locked)
setInterval(() => {
  const cutoff = now() - (24 * 60 * 60 * 1000); // 24 hours
  for (const [ip, record] of failuresByIp.entries()) {
    if ((!record.failures || record.failures.length === 0) && (!record.lockedUntil || record.lockedUntil < now())) {
      failuresByIp.delete(ip);
    }
  }
}, 60 * 60 * 1000); // run hourly

module.exports = loginRateLimiter;
