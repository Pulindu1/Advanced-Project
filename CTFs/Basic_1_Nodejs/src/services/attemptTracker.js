// src/services/attemptTracker.js
// Simple in-memory tracker for counting non-admin /flag attempts per session.
// Keyed by the raw 'session' cookie when available, otherwise by username.

const attempts = Object.create(null);

function _keyFor(req) {
  if (req && req.cookies && req.cookies.session) return req.cookies.session;
  if (req && req.user && req.user.username) return `user:${req.user.username}`;
  return 'anon';
}

function incrementAttempt(sessionKey) {
  if (!sessionKey) sessionKey = 'anon';
  const v = attempts[sessionKey] || 0;
  attempts[sessionKey] = v + 1;
  return attempts[sessionKey];
}

function incrementAttemptForRequest(req) {
  const key = _keyFor(req);
  return incrementAttempt(key);
}

function getAttempts(sessionKey) {
  return attempts[sessionKey] || 0;
}

function getAttemptsForRequest(req) {
  return getAttempts(_keyFor(req));
}

module.exports = {
  incrementAttempt,
  incrementAttemptForRequest,
  getAttempts,
  getAttemptsForRequest
};
