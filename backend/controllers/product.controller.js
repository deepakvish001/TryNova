const Product = require('../models/Product.model');

exports.getProducts = async (req, res) => {
  try {
    const {
      category, price, gender, sizes, colors, brand,
      sort, search, page = 1, limit = 20
    } = req.query;

    let query = {};

    if (category && category !== 'All') {
      // Support comma-separated lists.
      const cats = String(category).split(',').map((c) => c.trim()).filter(Boolean);
      query.category = cats.length > 1 ? { $in: cats } : cats[0];
    }
    if (gender && gender !== 'All') query.gender = gender;
    if (sizes) query.sizes = { $in: String(sizes).split(',') };
    if (colors) query.colors = { $in: String(colors).split(',') };
    if (brand) query.brand = brand;
    if (search) {
      const rx = new RegExp(String(search).trim(), 'i');
      query.$or = [{ name: rx }, { description: rx }, { tags: rx }];
    }

    if (price) {
      const [min, max] = String(price).split('-');
      if (min && max) {
        query.price = { $gte: Number(min), $lte: Number(max) };
      }
    }

    let sortOptions = {};
    switch (sort) {
      case 'Newest':
        sortOptions.createdAt = -1; break;
      case 'Price Low-High':
        sortOptions.price = 1; break;
      case 'Price High-Low':
        sortOptions.price = -1; break;
      case 'Top Rated':
        sortOptions.rating = -1; break;
      case 'Trending':
      case 'trending':
        sortOptions.popularity = -1; break;
      default:
        sortOptions.popularity = -1;
    }

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
    const { category, excludeId } = req.query;
    let query = {};
    if (category) query.category = category;
    if (excludeId) query._id = { $ne: excludeId };

    const products = await Product.aggregate([
      { $match: query },
      { $sample: { size: 4 } }
    ]);

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Distinct facets used to populate filter UIs.
exports.getFacets = async (req, res) => {
  try {
    const [categories, genders, brands, colors] = await Promise.all([
      Product.distinct('category'),
      Product.distinct('gender'),
      Product.distinct('brand'),
      Product.distinct('colors')
    ]);
    res.json({
      success: true,
      data: {
        categories: categories.sort(),
        genders,
        brands: brands.filter(Boolean).sort(),
        colors: colors.filter(Boolean).sort()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
