// src/controllers/flagController.js
const { getFlagForUser } = require('../services/flagService');
const attemptTracker = require('../services/attemptTracker');

function getFlagController(req, res) {
  console.log('[flagController] req.cookies.session =', req.cookies && req.cookies.session);
  console.log('[flagController] req.user =', req.user);
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
  const rawUsername = req.user.username;
  const username = String(rawUsername || '').trim().toLowerCase();
  const result = getFlagForUser(username);
  const flag = result && result.flag;
  const canonical = result && result.canonical ? result.canonical : username;
  console.log('[flagController] resolved flag result =', result);
  console.log('[flagController] display username =', canonical);

  return res.render('flag', { username: canonical, flag });
}

module.exports = {
  getFlag: getFlagController
};
