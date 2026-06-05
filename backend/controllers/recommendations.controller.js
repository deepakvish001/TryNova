/**
 * Recommendation engine for TryNova.
 *
 * We blend three signals to personalise picks:
 *   1. Order history  - what the user actually bought.
 *   2. Cart contents  - what they're considering right now.
 *   3. Wishlist       - aspirational signal.
 *
 * From those we build a weighted profile over:
 *   - category preference
 *   - gender preference
 *   - colour preference
 *   - average price band
 *
 * For each candidate product we compute a similarity score and return the
 * top N. If the user has no history we gracefully fall back to top-rated
 * trending products.
 */

const Product = require('../models/Product.model');
const Order = require('../models/Order.model');
const Cart = require('../models/Cart.model');
const User = require('../models/User.model');

const WEIGHTS = { order: 3, cart: 2, wishlist: 1 };

function bumpCounter(map, key, weight) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + weight);
}

function topKey(map) {
    let bestKey = null;
    let bestVal = -Infinity;
    for (const [k, v] of map) {
        if (v > bestVal) { bestVal = v; bestKey = k; }
    }
    return bestKey;
}

async function buildProfile(userId) {
    const profile = {
        categoryScores: new Map(),
        genderScores: new Map(),
        colorScores: new Map(),
        priceSum: 0,
        priceCount: 0,
        productIds: new Set()
    };

    const orders = await Order.find({ userId }).lean();
    for (const order of orders) {
        for (const item of order.items || []) {
            const w = WEIGHTS.order * (item.quantity || 1);
            bumpCounter(profile.categoryScores, item.category, w);
            bumpCounter(profile.colorScores, item.color, w);
            if (item.price) {
                profile.priceSum += item.price * w;
                profile.priceCount += w;
            }
            if (item.productId) profile.productIds.add(String(item.productId));
        }
    }

    // Enrich with product docs so we can read category / gender / colors when
    // the order item snapshot is missing fields.
    if (profile.productIds.size) {
        const docs = await Product.find({
            _id: { $in: Array.from(profile.productIds) }
        }).lean();
        for (const p of docs) {
            bumpCounter(profile.categoryScores, p.category, WEIGHTS.order);
            bumpCounter(profile.genderScores, p.gender, WEIGHTS.order);
            (p.colors || []).forEach((c) => bumpCounter(profile.colorScores, c, WEIGHTS.order));
        }
    }

    const cart = await Cart.findOne({ userId }).populate('items.productId').lean();
    if (cart && cart.items) {
        for (const item of cart.items) {
            const p = item.productId;
            if (!p) continue;
            const w = WEIGHTS.cart * (item.quantity || 1);
            bumpCounter(profile.categoryScores, p.category, w);
            bumpCounter(profile.genderScores, p.gender, w);
            (p.colors || []).forEach((c) => bumpCounter(profile.colorScores, c, w));
            if (p.price) {
                profile.priceSum += p.price * w;
                profile.priceCount += w;
            }
            profile.productIds.add(String(p._id));
        }
    }

    const user = await User.findById(userId).lean();
    if (user && user.savedLooks) {
        for (const look of user.savedLooks) {
            if (look.productId) profile.productIds.add(String(look.productId));
        }
    }

    profile.avgPrice = profile.priceCount > 0
        ? profile.priceSum / profile.priceCount
        : null;
    profile.topCategory = topKey(profile.categoryScores);
    profile.topGender = topKey(profile.genderScores);
    profile.topColor = topKey(profile.colorScores);

    return profile;
}

function scoreProduct(product, profile) {
    let score = 0;
    const catScore = profile.categoryScores.get(product.category) || 0;
    const genScore = profile.genderScores.get(product.gender) || 0;
    score += catScore * 2;
    score += genScore * 1.5;
    for (const c of product.colors || []) {
        score += (profile.colorScores.get(c) || 0) * 0.5;
    }
    if (profile.avgPrice) {
        // Closer to user's typical price = better. Penalise large deviations.
        const ratio = Math.abs(product.price - profile.avgPrice) / profile.avgPrice;
        score += Math.max(0, 3 - ratio * 3);
    }
    // Quality nudge.
    score += (product.rating || 0) * 0.4;
    return score;
}

exports.getPersonalized = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 8, 24);
        const profile = await buildProfile(req.user.id);

        // No signal -> return top-rated trending products.
        const hasSignal = profile.categoryScores.size || profile.productIds.size;
        if (!hasSignal) {
            const fallback = await Product.find()
                .sort({ rating: -1 })
                .limit(limit)
                .lean();
            return res.json({
                success: true,
                data: fallback,
                reason: 'trending',
                profile: null
            });
        }

        const excludeIds = Array.from(profile.productIds);
        const candidates = await Product.find({
            _id: { $nin: excludeIds }
        }).lean();

        const scored = candidates
            .map((p) => ({ product: p, score: scoreProduct(p, profile) }))
            .filter((s) => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map((s) => s.product);

        res.json({
            success: true,
            data: scored,
            reason: 'personalized',
            profile: {
                topCategory: profile.topCategory,
                topGender: profile.topGender,
                topColor: profile.topColor,
                avgPrice: profile.avgPrice ? Math.round(profile.avgPrice) : null
            }
        });
    } catch (error) {
        console.error('Personalized recs error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * "Complete the Look" — given a product or cart, suggest complementary items
 * from other categories (e.g. shirt -> jeans + jacket; dress -> jacket).
 */
const COMPLEMENT_MAP = {
    'T-Shirts': ['Jeans', 'Jackets', 'Hoodies'],
    'Shirts': ['Jeans', 'Jackets'],
    'Hoodies': ['Jeans', 'T-Shirts'],
    'Jackets': ['T-Shirts', 'Shirts', 'Jeans'],
    'Jeans': ['T-Shirts', 'Shirts', 'Jackets'],
    'Dresses': ['Jackets']
};

exports.getCompleteTheLook = async (req, res) => {
    try {
        const { productId } = req.query;
        if (!productId) {
            return res.status(400).json({ success: false, message: 'productId required' });
        }
        const product = await Product.findById(productId).lean();
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        const targetCats = COMPLEMENT_MAP[product.category] || [];
        if (!targetCats.length) {
            return res.json({ success: true, data: [] });
        }
        const minPrice = product.price * 0.5;
        const maxPrice = product.price * 1.8;
        const matches = await Product.aggregate([
            { $match: {
                category: { $in: targetCats },
                gender: { $in: [product.gender, 'Unisex'] },
                price: { $gte: minPrice, $lte: maxPrice },
                _id: { $ne: product._id }
            }},
            { $sample: { size: 6 } }
        ]);
        res.json({ success: true, data: matches });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Trending products — based on actual order frequency.
 */
exports.getTrending = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 8, 24);
        const agg = await Order.aggregate([
            { $unwind: '$items' },
            { $group: {
                _id: '$items.productId',
                soldCount: { $sum: '$items.quantity' }
            }},
            { $sort: { soldCount: -1 } },
            { $limit: limit }
        ]);
        const ids = agg.map((a) => a._id).filter(Boolean);
        let products = [];
        if (ids.length) {
            products = await Product.find({ _id: { $in: ids } }).lean();
            // Preserve order by soldCount.
            const order = new Map(ids.map((id, i) => [String(id), i]));
            products.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
        }
        // Top up with high-rated products if we don't have enough order data yet.
        if (products.length < limit) {
            const extras = await Product.find({ _id: { $nin: ids } })
                .sort({ rating: -1 })
                .limit(limit - products.length)
                .lean();
            products = products.concat(extras);
        }
        res.json({ success: true, data: products });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
