const fs = require('fs');
const path = require('path');

const FLAGS_PATH = path.join(__dirname, '..', 'data', 'flags.json');

function loadFlags() {
  return JSON.parse(fs.readFileSync(FLAGS_PATH, 'utf8'));
}

module.exports = { loadFlags };
