// src/services/userService.js
const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '..', 'data', 'users.json');

// Read users from disk on each call so that the seeded data from server.js is picked up.
// Fine for a small CTF app with few users.
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
  } catch (err) {
    return [];
  }
}

function findUserByUsername(username) {
  const users = readUsers();
  return users.find((u) => u.username === username);
}

module.exports = {
  findUserByUsername
};
