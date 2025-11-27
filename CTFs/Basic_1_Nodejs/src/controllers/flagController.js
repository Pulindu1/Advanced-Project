// src/controllers/flagController.js
const { getFlagForUser } = require('../services/flagService');

function getFlagController(req, res) {
  // 1) Not logged in at all → redirect to login
  if (!req.user) {
    return res.redirect('/');
  }

  // 2) Logged in but not admin → show "Admins only" page
  if (req.user.role !== 'admin') {
    return res.status(403).render('forbidden');
  }

  // 3) Logged in as admin → show per-user flag
  const username = req.user.username;
  const flag = getFlagForUser(username);

  return res.render('flag', { username, flag });
}

module.exports = {
  getFlag: getFlagController
};
