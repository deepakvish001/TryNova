const express = require('express');
const router = express.Router();
const { getStylistSuggestions } = require('../controllers/stylist.controller');

router.post('/', getStylistSuggestions);

module.exports = router;
