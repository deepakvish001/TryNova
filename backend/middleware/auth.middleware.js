const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/jwt');

const protect = (req, res, next) => {
  const header = req.headers.authorization || '';

  // Require the scheme *and* a non-empty credential. `startsWith('Bearer')`
  // alone also matched things like "BearerX", and an "Authorization: Bearer"
  // header with no token left `token` undefined.
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET); // { id: userId }
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };
