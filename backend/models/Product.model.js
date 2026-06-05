const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  id: { type: String }, // optional custom string id if needed
  name: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['T-Shirts', 'Shirts', 'Hoodies', 'Jackets', 'Jeans', 'Dresses'],
    required: true
  },
  gender: { 
    type: String, 
    enum: ['Men', 'Women', 'Unisex'],
    required: true
  },
  price: { type: Number, required: true },
  images: [{ type: String }],
  description: { type: String },
  sizes: [{ type: String }],
  colors: [{ type: String }],
  stock: { type: Number, default: 100 },
  rating: { type: Number, default: 0 },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
