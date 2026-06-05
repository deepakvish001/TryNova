const Order = require('../models/Order.model');
const Cart = require('../models/Cart.model');

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.productId');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Calculate total
    let total = 0;
    const orderItems = cart.items.map(item => {
      const price = item.productId.price;
      total += price * item.quantity;
      return {
        productId: item.productId._id,
        name: item.productId.name,
        price: price,
        image: item.productId.images[0],
        size: item.size,
        color: item.color,
        quantity: item.quantity
      };
    });

    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      total: total,
      shippingAddress: req.body.shippingAddress || {},
      status: 'pending'
    });

    // Clear cart
    cart.items = [];
    await cart.save();

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
