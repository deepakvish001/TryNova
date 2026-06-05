const Cart = require('../models/Cart.model');

exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] });
    }
    res.json({ success: true, data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { productId, size, color, quantity } = req.body;
    let cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] });
    }

    const itemIndex = cart.items.findIndex(p => p.productId.toString() === productId && p.size === size && p.color === color);

    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity || 1;
    } else {
      cart.items.push({ productId, size, color, quantity: quantity || 1 });
    }

    await cart.save();
    const updatedCart = await Cart.findById(cart._id).populate('items.productId');
    res.json({ success: true, data: updatedCart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { id } = req.params; // Item ID in the array, or product ID
    const { quantity } = req.body;

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    // Assuming id is the _id of the item in the items array
    const item = cart.items.id(id);
    if (item) {
        item.quantity = quantity;
        await cart.save();
        const updatedCart = await Cart.findById(cart._id).populate('items.productId');
        return res.json({ success: true, data: updatedCart });
    }

    res.status(404).json({ success: false, message: 'Item not found in cart' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { id } = req.params; // item id
    let cart = await Cart.findOne({ userId: req.user.id });
    
    if (cart) {
      cart.items = cart.items.filter(item => item._id.toString() !== id);
      await cart.save();
      const updatedCart = await Cart.findById(cart._id).populate('items.productId');
      res.json({ success: true, data: updatedCart });
    } else {
      res.status(404).json({ success: false, message: 'Cart not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
