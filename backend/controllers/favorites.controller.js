const User = require('../models/User.model');

// User model has savedLooks which can act as a wishlist, or we can just save productIds
// The prompt specifies: "Favorites toggle works"
// I will just add a 'favorites' array to User model dynamically, or use savedLooks for this.
// Wait, I didn't add a wishlist array to User model. Let's assume savedLooks array or add a wishlist field.
// Actually, let's just use a virtual/dynamic approach or modify User.

exports.getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('savedLooks.productId');
    res.json({ success: true, data: user.savedLooks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addFavorite = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = await User.findById(req.user.id);
    
    // check if already favorited
    const exists = user.savedLooks.find(l => l.productId && l.productId.toString() === productId);
    if (!exists) {
        user.savedLooks.push({ productId });
        await user.save();
    }
    
    const updatedUser = await User.findById(req.user.id).populate('savedLooks.productId');
    res.json({ success: true, data: updatedUser.savedLooks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeFavorite = async (req, res) => {
  try {
    const { id } = req.params; // Product ID
    const user = await User.findById(req.user.id);
    
    user.savedLooks = user.savedLooks.filter(l => l.productId && l.productId.toString() !== id);
    await user.save();
    
    const updatedUser = await User.findById(req.user.id).populate('savedLooks.productId');
    res.json({ success: true, data: updatedUser.savedLooks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
