const express = require('express');
const router = express.Router();
const { getProducts, getProductById, getRecommendations } = require('../controllers/product.controller');

router.get('/recommendations', getRecommendations);
router.get('/:id', getProductById);
router.get('/', getProducts);

module.exports = router;
