const Product = require('../models/Product.model');

exports.getStylistSuggestions = async (req, res) => {
  try {
    const { occasion, vibe, colors, gender } = req.body;
    
    // Very simple mockup AI logic:
    // We try to match gender, and randomly pick 6 products.
    // In a real app, this would send a prompt to an LLM to get product IDs based on descriptions.
    
    let query = {};
    if (gender && gender !== 'Unisex') {
      query.gender = { $in: [gender, 'Unisex'] };
    }
    
    // Pick 6 random products
    const products = await Product.aggregate([
      { $match: query },
      { $sample: { size: 6 } }
    ]);
    
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
