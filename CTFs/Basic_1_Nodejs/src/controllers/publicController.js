// src/controllers/publicController.js
const path = require('path');

exports.home = (req, res) => {
  // Serve a simple HTML page from public/index.html
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
};

exports.status = (req, res) => {
  res.json({
    ok: true,
    message: 'Node CTF is running. Try exploring /debug and /flag 😉'
  });
};
