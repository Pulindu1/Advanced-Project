const express = require('express');
const attemptTracker = require('../services/attemptTracker');

const router = express.Router();

router.get('/debug', (req, res) => {
  const visits = attemptTracker.incrementAttemptForRequest(req);

  const response = {
    note: 'Debug endpoint. Shows your parsed profile cookie.',
    profile: req.userProfile || null,
    _engine: 'node-serialize@0.0.4',
    _engineNote: 'Profile data is deserialized server-side on every page load using this engine.',
    _appRoot: process.cwd(),
  };

  if (visits >= 2) {
    response._hint = 'CVE-2017-5941: functions embedded in serialized data are reconstructed and immediately executed on deserialization. See https://www.npmjs.com/package/node-serialize';
  }

  res.json(response);
});

module.exports = router;
