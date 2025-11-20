// src/controllers/flagController.js
const { getFlag } = require('../services/flagService');

function getFlagController(req, res) {
  // 1) Not logged in at all → redirect to login
  if (!req.user) {
    return res.redirect('/');
  }

  // 2) Logged in but not admin → show "Admins only" page
  if (req.user.role !== 'admin') {
    return res.status(403).send(`
      <h1>Admins only</h1>
      <p>You found the admin area, but you're not an admin yet.</p>
      <p>Hint: how does the site remember who you are? Can that be modified?</p>
      <p><a href="/home">Back to home</a></p>
    `);
  }

  // 3) Logged in as admin → show flag
  const flag = getFlag();

  return res.send(`
    <h1>Congratulations, ${req.user.username}!</h1>
    <p>You have admin access.</p>
    <p>Your flag is:</p>
    <pre>${flag}</pre>
    <p>For your dissertation: this demonstrates a privilege escalation via insecure cookies / login logic.</p>
  `);
}

module.exports = {
  getFlag: getFlagController
};
