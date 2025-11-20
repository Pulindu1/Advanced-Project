// src/services/flagService.js
const { FLAG } = require('../config');

function getFlag() {
  return FLAG;
}

module.exports = {
  getFlag
};
