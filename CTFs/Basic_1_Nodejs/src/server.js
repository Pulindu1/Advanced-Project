// src/server.js
require('dotenv').config();
const { PORT } = require('./config');
const app = require('./app');

app.listen(PORT, () => {
  console.log(`[*] Node CTF listening on http://localhost:${PORT}`);
});
