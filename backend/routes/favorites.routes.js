const express = require('express');
const router = express.Router();
const { getFavorites, addFavorite, removeFavorite } = require('../controllers/favorites.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/', getFavorites);
router.post('/add', addFavorite);
router.delete('/remove/:id', removeFavorite);

module.exports = router;
