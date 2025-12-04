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

  // Normalize username: trim, toLowerCase, remove surrounding whitespace
  const key = String(username).trim().toLowerCase();

  // Direct match
  if (flagsByUser[key]) return { flag: flagsByUser[key], canonical: key };
  // Try a couple of tolerant fallbacks: remove non-alphanumerics
  const alnum = key.replace(/[^a-z0-9]/g, '');
  if (alnum !== key && flagsByUser[alnum]) return { flag: flagsByUser[alnum], canonical: alnum };

  // Try fuzzy match (Levenshtein distance <= 1) against configured flags
  let best = { dist: Infinity, candidate: null };
  const keys = Object.keys(flagsByUser);
  for (const candidate of keys) {
    // skip exact matches (already handled)
    if (candidate === key) continue;
    // simple length check optimization
    if (Math.abs(candidate.length - key.length) > 1) continue;
    // compute Levenshtein distance
    const dist = levenshtein(candidate, key);
    if (dist < best.dist) {
      best = { dist, candidate };
    }
  }
  if (best.dist <= 1 && best.candidate) {
    console.log(`[flagService] fuzzy-match ${key} -> ${best.candidate}`);
    return { flag: flagsByUser[best.candidate], canonical: best.candidate };
  }

  // If CTF_DEV=1, synthesize a development flag so admins always see something
  if (process.env.CTF_DEV && process.env.CTF_DEV === '1') {
    const token = Buffer.from(key).toString('hex').slice(0, 8);
    console.log(`[flagService] no configured flag for ${key}; synthesizing dev flag`);
    return { flag: `durham{${token}_${key}}`, canonical: key };
  }

  // No match found
  return null;
}

// Simple Levenshtein distance implementation
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
    }
  }
  return dp[m][n];
}

module.exports = {
  getFlagForUser
};
