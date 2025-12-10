const crypto = require('crypto');

// ctf2_generator.js
// Deterministic token generator for the CTF_2 password manager.
// Same contract as basic1_generator: same username + salt => same token.
// Options accepted:
//  - salt: string used as HMAC key (default: 'ctf2-default-salt')
//  - tokenLength: number of hex characters to emit (default: 20)

module.exports = function ctf2Generator(username, options = {}) {
  const salt = options.salt || 'ctf2-default-salt';
  const tokenLength = options.tokenLength || 20;
  const h = crypto.createHmac('sha256', String(salt)).update(String(username)).digest('hex');
  return h.slice(0, tokenLength);
};
