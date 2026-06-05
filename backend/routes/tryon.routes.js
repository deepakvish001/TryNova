const express = require('express');
const router = express.Router();
const { processTryOn } = require('../controllers/tryon.controller');
const { protect } = require('../middleware/auth.middleware');

// We use an optional auth middleware here if we want to allow guests. 
// For now, let's make it a normal route, and we'll extract user from token if it exists manually or using a soft-protect.
const softProtect = require('jsonwebtoken');

const optionalAuth = (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    const token = req.headers.authorization.split(' ')[1];
    try {
      const decoded = softProtect.verify(token, process.env.JWT_SECRET || 'trynova_super_secret_jwt_key_2026');
      req.user = decoded;
    } catch (error) {
      // ignore
    }
  }
  next();
};

router.post('/', optionalAuth, processTryOn);

module.exports = router;
