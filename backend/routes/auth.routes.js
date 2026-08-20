const express = require('express');
const router = express.Router();
const { signup, login, getMe } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateSignup, validateLogin } = require('../middleware/validate');

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.get('/me', protect, getMe);

module.exports = router;
