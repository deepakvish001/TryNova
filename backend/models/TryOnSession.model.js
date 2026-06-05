const mongoose = require('mongoose');

const tryOnSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // optional, for logged in users
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  userImageUrl: { type: String, required: true },
  resultImageUrl: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TryOnSession', tryOnSessionSchema);
