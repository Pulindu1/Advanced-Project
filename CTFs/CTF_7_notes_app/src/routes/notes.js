const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const NOTES_PATH = path.join(__dirname, '..', 'data', 'notes.json');

function loadNotes() {
  return JSON.parse(fs.readFileSync(NOTES_PATH, 'utf8'));
}

router.get('/note/:id', (req, res) => {
  if (!req.userProfile || !req.userProfile.username) {
    return res.redirect('/');
  }

  if (!/^\d+$/.test(req.params.id)) {
    return res.status(400).render('forbidden', { message: 'Invalid note ID.' });
  }

  const notes = loadNotes();
  const noteId = parseInt(req.params.id, 10);
  const note = notes.find(n => n.id === noteId);

  if (!note) {
    return res.status(404).render('forbidden', { message: 'Note not found.' });
  }

  res.render('note', { note, userProfile: req.userProfile });
});

module.exports = router;
