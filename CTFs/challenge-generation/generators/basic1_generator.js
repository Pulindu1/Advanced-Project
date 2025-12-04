const crypto = require('crypto');

// basic1_generator.js
// Deterministic token generator for the Basic_1 CTF.
// The generator should be deterministic: same username + salt => same token.
// Options accepted:
//  - salt: string used as HMAC key (default: 'basic1-default-salt')
//  - tokenLength: number of hex characters to emit (default: 16)

module.exports = function basic1Generator(username, options = {}) {
  const salt = options.salt || 'basic1-default-salt';
  const tokenLength = options.tokenLength || 16;
  const h = crypto.createHmac('sha256', String(salt)).update(String(username)).digest('hex');
  return h.slice(0, tokenLength);
};

// Example: basic1Generator('abcd12', { salt: 'ctf-2025-basic1', tokenLength: 20 })
