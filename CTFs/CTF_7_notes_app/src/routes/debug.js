const express = require('express');
const attemptTracker = require('../services/attemptTracker');

const router = express.Router();

router.get('/debug', (req, res) => {
  const visits = attemptTracker.incrementAttemptForRequest(req);

  const response = {
    note: 'Debug endpoint. Shows your parsed profile cookie.',
    profile: req.userProfile || null,
    _engine: 'node-serialize@0.0.4',
  };

  if (visits >= 4) {
    response._hint = 'See https://www.npmjs.com/package/node-serialize and CVE-2017-5941';
  }

  res.json(response);
});

module.exports = router;
