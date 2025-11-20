// src/services/userService.js
const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '..', 'data', 'users.json');

// Synchronously load users from JSON (fine for a small CTF app)
const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

function findUserByUsername(username) {
  return users.find((u) => u.username === username);
}

module.exports = {
  findUserByUsername
};
