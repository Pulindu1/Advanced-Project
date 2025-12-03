// src/controllers/flagController.js
const { getFlagForUser } = require('../services/flagService');
const attemptTracker = require('../services/attemptTracker');

function getFlagController(req, res) {
  // 1) Not logged in at all → redirect to login
  if (!req.user) {
    return res.redirect('/');
  }

  // 2) Logged in but not admin → increment attempts and show "Admins only" page
  if (req.user.role !== 'admin') {
    const attempts = attemptTracker.incrementAttemptForRequest(req);
    const showHint = attempts >= 4; // show hint after 4 or more attempts
    return res.status(403).render('forbidden', { showHint });
  }

  // 3) Logged in as admin → show per-user flag
  const username = req.user.username;
  const flag = getFlagForUser(username);

  return res.render('flag', { username, flag });
}

module.exports = {
  getFlag: getFlagController
};
