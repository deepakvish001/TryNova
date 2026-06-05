const express = require('express');
const router = express.Router();
const { getOrders, createOrder } = require('../controllers/order.controller');
const { protect } = require('../middleware/auth.middleware');

router.use(protect);
router.get('/', getOrders);
router.post('/create', createOrder);

module.exports = router;
