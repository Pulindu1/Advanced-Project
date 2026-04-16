const express = require('express');

const router = express.Router();

router.get('/about', (req, res) => {
  res.render('about', { userProfile: req.userProfile || null });
});

router.get('/flag', (req, res) => {
  res.render('flag');
});

module.exports = router;
