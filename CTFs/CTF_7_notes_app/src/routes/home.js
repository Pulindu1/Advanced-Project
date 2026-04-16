const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const NOTES_PATH = path.join(__dirname, '..', 'data', 'notes.json');

function loadNotes() {
  return JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
}

router.get('/home', (req, res) => {
  if (!req.userProfile || !req.userProfile.username) {
    return res.redirect('/');
  }

  const notes = loadNotes();
  res.render('home', { userProfile: req.userProfile, notes });
});

module.exports = router;
