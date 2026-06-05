const Product = require('../models/Product.model');

exports.getProducts = async (req, res) => {
  try {
    const { category, price, gender, sizes, colors, sort, page = 1, limit = 20 } = req.query;
    
    let query = {};
    
    if (category && category !== 'All') query.category = category;
    if (gender && gender !== 'All') query.gender = gender;
    if (sizes) query.sizes = { $in: sizes.split(',') };
    if (colors) query.colors = { $in: colors.split(',') };
    
    if (price) {
      // price format expected: min-max
      const [min, max] = price.split('-');
      if (min && max) {
        query.price = { $gte: Number(min), $lte: Number(max) };
      }
    }

    let sortOptions = {};
    if (sort === 'Newest') sortOptions.createdAt = -1;
    else if (sort === 'Price Low-High') sortOptions.price = 1;
    else if (sort === 'Price High-Low') sortOptions.price = -1;
    else if (sort === 'trending') sortOptions.rating = -1; // arbitrary mapping for trending

    const startIndex = (Number(page) - 1) * Number(limit);
    
    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortOptions)
      .limit(Number(limit))
      .skip(startIndex);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRecommendations = async (req, res) => {
  try {
    const { category } = req.query;
    let query = {};
    if (category) {
      query.category = category;
    }
    // Get 4 random or top-rated products from the same category
    const products = await Product.aggregate([
      { $match: query },
      { $sample: { size: 4 } }
    ]);
    
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
