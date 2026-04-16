const fs = require('fs');
const path = require('path');
const { loadFlags } = require('./flagService');

const FLAG_FILES_DIR = path.join(__dirname, '..', 'data', 'flag-files');

function syncFlagFiles() {
  const flags = loadFlags();

  fs.mkdirSync(FLAG_FILES_DIR, { recursive: true });

  let count = 0;
  for (const [username, flag] of Object.entries(flags)) {
    const filePath = path.join(FLAG_FILES_DIR, `${username}.txt`);
    fs.writeFileSync(filePath, flag);
    count++;
  }

  console.log(`[flagSync] Synchronised ${count} flag files to ${FLAG_FILES_DIR}`);
}

module.exports = syncFlagFiles;
