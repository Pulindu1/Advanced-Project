// src/services/attemptTracker.js
// Simple in-memory tracker for counting /debug visits.
// Keyed by the raw 'profile' cookie when available, otherwise by IP.

const attempts = Object.create(null);

function _keyFor(req) {
  if (req && req.cookies && req.cookies.profile) return req.cookies.profile;
  return req.ip || 'anon';
}

function incrementAttemptForRequest(req) {
  const key = _keyFor(req);
  const v = attempts[key] || 0;
  attempts[key] = v + 1;
  return attempts[key];
}

function getAttemptsForRequest(req) {
  const key = _keyFor(req);
  return attempts[key] || 0;
}

module.exports = {
  incrementAttemptForRequest,
  getAttemptsForRequest,
};
