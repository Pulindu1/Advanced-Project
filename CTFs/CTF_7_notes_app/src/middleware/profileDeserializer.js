// This middleware is DELIBERATELY VULNERABLE. Do not refactor.
// It reproduces CVE-2017-5941 for educational purposes.
const serialize = require('node-serialize');

module.exports = function profileDeserializer(req, res, next) {
  if (req.cookies && req.cookies.profile) {
    try {
      const decoded = Buffer.from(req.cookies.profile, 'base64').toString('utf8');
      req.userProfile = serialize.unserialize(decoded);
    } catch (err) {
      req.userProfile = null;
    }
  }
  next();
};
