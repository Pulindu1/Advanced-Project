// src/middleware/loginRateLimiter.js
// Simple in-memory per-IP login rate limiter with lockout window.
// Mirrors CTF1's loginRateLimiter.js.

const failuresByIp = new Map();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function now() { return Date.now(); }

function pruneOldFailures(record) {
  const cutoff = now() - WINDOW_MS;
  record.failures = record.failures.filter(ts => ts > cutoff);
}

function loginRateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';

  let record = failuresByIp.get(ip);
  const n = now();

  if (record && record.lockedUntil && n < record.lockedUntil) {
    const retryInMs = record.lockedUntil - n;
    const retrySec = Math.ceil(retryInMs / 1000);
    return res.status(429).render('lockout', { retrySec });
  }

  if (!record) {
    record = { failures: [], lockedUntil: null };
    failuresByIp.set(ip, record);
  }

  res.on('finish', () => {
    if (req.method !== 'POST') return;

    const status = res.statusCode;

    if (status === 401 || status === 403) {
      record.failures.push(now());
      pruneOldFailures(record);

      if (record.failures.length >= MAX_ATTEMPTS) {
        record.lockedUntil = now() + LOCKOUT_MS;
      }
    } else if (status === 302 || status === 200) {
      record.failures = [];
      record.lockedUntil = null;
    }
  });

  return next();
}

setInterval(() => {
  for (const [ip, record] of failuresByIp.entries()) {
    if ((!record.failures || record.failures.length === 0) && (!record.lockedUntil || record.lockedUntil < now())) {
      failuresByIp.delete(ip);
    }
  }
}, 60 * 60 * 1000);

module.exports = loginRateLimiter;
