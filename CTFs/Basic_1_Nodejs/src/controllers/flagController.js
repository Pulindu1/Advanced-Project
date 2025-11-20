// src/controllers/flagController.js
const { getFlag } = require('../services/flagService');

function getFlagController(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admins only. You should not be here without the exploit.'
    });
  }

  const flag = getFlag();

  return res.json({
    message: 'Congratulations, admin!',
    flag
  });
}

module.exports = {
  getFlag: getFlagController
};
