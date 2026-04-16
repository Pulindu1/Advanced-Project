const crypto = require('crypto');

// ctf7_generator.js
// Deterministic token generator for the CTF7 NorthSide Notes challenge.
// Same username + salt => same token every time.
// Options accepted:
//  - salt: string used as HMAC key (default: 'ctf7-default-salt')
//  - tokenLength: number of hex characters to emit (default: 16)

module.exports = function ctf7Generator(username, options = {}) {
  const salt = options.salt || 'ctf7-default-salt';
  const tokenLength = options.tokenLength || 16;
  const h = crypto.createHmac('sha256', String(salt)).update(String(username)).digest('hex');
  return h.slice(0, tokenLength);
};
