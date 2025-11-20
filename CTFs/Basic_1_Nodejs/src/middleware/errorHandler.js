// src/middleware/errorHandler.js
module.exports = function errorHandler(err, req, res, next) {
  console.error('[!] Unhandled error:', err);

  // Never leak stack traces to players in production/CTF
  res.status(500).json({
    error: 'Something went wrong.'
  });
};
