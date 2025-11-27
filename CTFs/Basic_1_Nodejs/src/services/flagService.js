// src/services/flagService.js
const fs = require('fs');
const path = require('path');

// Load per-user flags from JSON file if present; fall back to global FLAG env var
const flagsPath = path.join(__dirname, '..', 'data', 'flags.json');
let flagsByUser = {};

try {
  if (fs.existsSync(flagsPath)) {
    const raw = fs.readFileSync(flagsPath, 'utf8');
    flagsByUser = JSON.parse(raw);
  }
} catch (err) {
  console.error('Failed to load flags.json:', err.message);
  flagsByUser = {};
}

function getFlagForUser(username) {
  if (!username) return null;
  return flagsByUser[username] || null;
}

module.exports = {
  getFlagForUser
};
