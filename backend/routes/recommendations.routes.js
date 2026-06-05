const express = require('express');
const router = express.Router();
const {
    getPersonalized,
    getCompleteTheLook,
    getTrending
} = require('../controllers/recommendations.controller');
const { protect } = require('../middleware/auth.middleware');

// Public — no auth needed for general trending/complete-the-look
router.get('/trending', getTrending);
router.get('/complete-the-look', getCompleteTheLook);

// Auth required for personalized
router.get('/personalized', protect, getPersonalized);

module.exports = router;
