const crypto = require('crypto');

// ctf8_generator.js
// Deterministic token generator for the CTF_8 Greystone Gazette challenge.
// Produces three distinct tokens per username (one per flag) by mixing a
// per-flag sub-salt into the base salt before HMAC.
//
// Options accepted:
//  - salt: base HMAC key (default: 'ctf8-gz-default-salt')
//  - tokenLength: number of hex characters per token (default: 16)

function tokenFor(username, baseSalt, subSalt, tokenLength) {
  const key = `${baseSalt}-${subSalt}`;
  const h = crypto.createHmac('sha256', key).update(String(username)).digest('hex');
  return h.slice(0, tokenLength);
}

module.exports = function ctf8Generator(username, options = {}) {
  const salt = options.salt || 'ctf8-gz-default-salt';
  const tokenLength = options.tokenLength || 16;
  return {
    flag1: tokenFor(username, salt, 'flag1', tokenLength),
    flag2: tokenFor(username, salt, 'flag2', tokenLength),
    flag3: tokenFor(username, salt, 'flag3', tokenLength),
  };
};
