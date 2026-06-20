/**
 * Demo Mode
 * ---------
 * If the live backend isn't reachable (e.g. on a Vercel static deploy), we
 * transparently fall back to a local catalogue plus localStorage-backed
 * cart / favourites / orders / recommendations so the whole UI keeps
 * working for demos and interviews.
 *
 * api.js routes here automatically on the first network failure and stays in
 * demo mode for the rest of the session.
 */
(function (global) {
    const STORAGE = {
        products: null,
        cart: 'trynova:demo_cart',
        favorites: 'trynova:demo_favorites',
        orders: 'trynova:demo_orders',
        user: 'trynova:demo_user'
    };

    let productsCache = null;

    async function loadProducts() {
        if (productsCache) return productsCache;
        const res = await fetch('data/products.json');
        productsCache = await res.json();
        return productsCache;
    }

    const ls = {
        get(key, fallback) {
            try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
            catch (e) { return fallback; }
        },
        set(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
    };

    function ok(data, extra = {}) {
        return { success: true, data, ...extra };
    }
    function err(message, status = 400) {
        return Promise.reject(Object.assign(new Error(message), { status }));
    }

    function paginate(list, page, limit) {
        const total = list.length;
        const start = (page - 1) * limit;
        return {
            data: list.slice(start, start + limit),
            pagination: { total, page, pages: Math.ceil(total / limit) }
        };
    }

    function parseQuery(qs) {
        const out = {};
        if (!qs) return out;
        const idx = qs.indexOf('?');
        const search = idx >= 0 ? qs.slice(idx + 1) : qs;
        new URLSearchParams(search).forEach((v, k) => { out[k] = v; });
        return out;
    }

    function filterProducts(products, q) {
        let list = products.slice();
        if (q.category && q.category !== 'All') {
            const cats = q.category.split(',');
            list = list.filter((p) => cats.includes(p.category));
        }
        if (q.gender && q.gender !== 'All') list = list.filter((p) => p.gender === q.gender);
        if (q.brand) list = list.filter((p) => p.brand === q.brand);
        if (q.sizes) {
            const wanted = q.sizes.split(',');
            list = list.filter((p) => p.sizes.some((s) => wanted.includes(s)));
        }
        if (q.colors) {
            const wanted = q.colors.split(',');
            list = list.filter((p) => p.colors.some((c) => wanted.includes(c)));
        }
        if (q.search) {
            const rx = new RegExp(q.search.trim(), 'i');
            list = list.filter((p) =>
                rx.test(p.name) || rx.test(p.description || '') ||
                (p.tags || []).some((t) => rx.test(t))
            );
        }
        if (q.price) {
            const [lo, hi] = q.price.split('-').map(Number);
            if (!isNaN(lo) && !isNaN(hi)) {
                list = list.filter((p) => p.price >= lo && p.price <= hi);
            }
        }
        switch (q.sort) {
            case 'Newest': list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); break;
            case 'Price Low-High': list.sort((a, b) => a.price - b.price); break;
            case 'Price High-Low': list.sort((a, b) => b.price - a.price); break;
            case 'Top Rated': list.sort((a, b) => b.rating - a.rating); break;
            default: list.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        }
        return list;
    }

    function buildProfile() {
        const orders = ls.get(STORAGE.orders, []);
        const cart = ls.get(STORAGE.cart, []);
        const counters = {
            categoryScores: {}, genderScores: {}, colorScores: {},
            priceSum: 0, priceCount: 0, productIds: new Set()
        };
        const bump = (m, k, w) => { if (k) m[k] = (m[k] || 0) + w; };

        for (const o of orders) {
            for (const it of o.items || []) {
                const w = 3 * (it.quantity || 1);
                bump(counters.categoryScores, it.category, w);
                bump(counters.colorScores, it.color, w);
                if (it.price) { counters.priceSum += it.price * w; counters.priceCount += w; }
                if (it.productId) counters.productIds.add(it.productId);
            }
        }
        for (const it of cart) {
            const w = 2 * (it.quantity || 1);
            bump(counters.categoryScores, it.category, w);
            bump(counters.colorScores, it.color, w);
            if (it.price) { counters.priceSum += it.price * w; counters.priceCount += w; }
            counters.productIds.add(it.productId);
        }
        const topKey = (m) => {
            let best = null, val = -Infinity;
            for (const k in m) if (m[k] > val) { val = m[k]; best = k; }
            return best;
        };
        return {
            ...counters,
            avgPrice: counters.priceCount > 0 ? counters.priceSum / counters.priceCount : null,
            topCategory: topKey(counters.categoryScores),
            topGender: topKey(counters.genderScores),
            topColor: topKey(counters.colorScores)
        };
    }

    function scoreProduct(product, profile) {
        let s = 0;
        s += (profile.categoryScores[product.category] || 0) * 2;
        s += (profile.genderScores[product.gender] || 0) * 1.5;
        for (const c of product.colors || []) {
            s += (profile.colorScores[c] || 0) * 0.5;
        }
        if (profile.avgPrice) {
            const ratio = Math.abs(product.price - profile.avgPrice) / profile.avgPrice;
            s += Math.max(0, 3 - ratio * 3);
        }
        s += (product.rating || 0) * 0.4;
        return s;
    }

    const COMPLEMENT_MAP = {
        'T-Shirts': ['Jeans', 'Jackets', 'Sneakers'],
        'Shirts': ['Jeans', 'Jackets', 'Sneakers'],
        'Hoodies': ['Jeans', 'T-Shirts', 'Sneakers'],
        'Jackets': ['T-Shirts', 'Shirts', 'Jeans'],
        'Jeans': ['T-Shirts', 'Shirts', 'Sneakers', 'Jackets'],
        'Dresses': ['Jackets', 'Accessories', 'Sneakers'],
        'Sneakers': ['Jeans', 'T-Shirts', 'Hoodies'],
        'Accessories': ['Shirts', 'Dresses', 'Jackets']
    };

    // ---- Endpoint dispatcher ----
    async function handle(method, endpoint, body) {
        const [path, qs] = endpoint.split('?');
        const q = parseQuery(qs ? '?' + qs : '');
        const segments = path.replace(/^\//, '').split('/');
        const root = segments[0];
        const products = await loadProducts();

        // ---- /products ----
        if (root === 'products') {
            if (segments.length === 1) {
                const filtered = filterProducts(products, q);
                const { data, pagination } = paginate(
                    filtered, Number(q.page || 1), Number(q.limit || 20)
                );
                return ok(data, { pagination });
            }
            if (segments[1] === 'facets') {
                return ok({
                    categories: [...new Set(products.map((p) => p.category))].sort(),
                    genders: [...new Set(products.map((p) => p.gender))],
                    brands: [...new Set(products.map((p) => p.brand).filter(Boolean))].sort(),
                    colors: [...new Set(products.flatMap((p) => p.colors || []))].sort()
                });
            }
            if (segments[1] === 'recommendations') {
                const cat = q.category;
                const ex = q.excludeId;
                let pool = products.filter((p) => (!cat || p.category === cat) && p._id !== ex);
                pool = pool.sort(() => 0.5 - Math.random()).slice(0, 4);
                return ok(pool);
            }
            // /products/:id
            const id = segments[1];
            const product = products.find((p) => p._id === id);
            if (!product) return err('Product not found', 404);
            return ok(product);
        }

        // ---- /recommendations ----
        if (root === 'recommendations') {
            if (segments[1] === 'trending') {
                const sorted = products.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                return ok(sorted.slice(0, Number(q.limit || 8)));
            }
            if (segments[1] === 'complete-the-look') {
                const anchor = products.find((p) => p._id === q.productId);
                if (!anchor) return ok([]);
                const targets = COMPLEMENT_MAP[anchor.category] || [];
                const lo = anchor.price * 0.5;
                const hi = anchor.price * 1.8;
                const matches = products.filter((p) =>
                    targets.includes(p.category) &&
                    [anchor.gender, 'Unisex'].includes(p.gender) &&
                    p.price >= lo && p.price <= hi &&
                    p._id !== anchor._id
                );
                return ok(matches.sort(() => 0.5 - Math.random()).slice(0, 6));
            }
            if (segments[1] === 'personalized') {
                const profile = buildProfile();
                const hasSignal = Object.keys(profile.categoryScores).length || profile.productIds.size;
                if (!hasSignal) {
                    const fallback = products.slice().sort((a, b) => b.rating - a.rating)
                        .slice(0, Number(q.limit || 8));
                    return ok(fallback, { reason: 'trending', profile: null });
                }
                const excluded = profile.productIds;
                const scored = products
                    .filter((p) => !excluded.has(p._id))
                    .map((p) => ({ p, s: scoreProduct(p, profile) }))
                    .filter((x) => x.s > 0)
                    .sort((a, b) => b.s - a.s)
                    .slice(0, Number(q.limit || 8))
                    .map((x) => x.p);
                return ok(scored, {
                    reason: 'personalized',
                    profile: {
                        topCategory: profile.topCategory,
                        topGender: profile.topGender,
                        topColor: profile.topColor,
                        avgPrice: profile.avgPrice ? Math.round(profile.avgPrice) : null
                    }
                });
            }
        }

        // ---- /cart ----
        if (root === 'cart') {
            const cart = ls.get(STORAGE.cart, []);
            if (method === 'GET') {
                // Hydrate productId with product object for frontend rendering compatibility.
                const items = cart.map((it) => ({
                    _id: it.lineId,
                    productId: products.find((p) => p._id === it.productId) || { _id: it.productId },
                    size: it.size, color: it.color, quantity: it.quantity
                }));
                return ok({ items });
            }
            if (method === 'POST' && segments[1] === 'add') {
                const { productId, size, color, quantity } = body;
                const product = products.find((p) => p._id === productId);
                if (!product) return err('Product not found', 404);
                const existing = cart.find((it) => it.productId === productId && it.size === size && it.color === color);
                if (existing) {
                    existing.quantity += quantity || 1;
                } else {
                    cart.push({
                        lineId: 'line_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        productId, size, color,
                        quantity: quantity || 1,
                        price: product.price, name: product.name,
                        image: product.images[0], category: product.category
                    });
                }
                ls.set(STORAGE.cart, cart);
                return handle('GET', '/cart');
            }
            if (method === 'PUT' && segments[1] === 'update') {
                const lineId = segments[2];
                const item = cart.find((it) => it.lineId === lineId);
                if (item) item.quantity = body.quantity;
                ls.set(STORAGE.cart, cart);
                return handle('GET', '/cart');
            }
            if (method === 'DELETE' && segments[1] === 'remove') {
                const lineId = segments[2];
                ls.set(STORAGE.cart, cart.filter((it) => it.lineId !== lineId));
                return handle('GET', '/cart');
            }
        }

        // ---- /favorites ----
        if (root === 'favorites') {
            const favs = ls.get(STORAGE.favorites, []);
            if (method === 'GET') {
                const hydrated = favs.map((id) => products.find((p) => p._id === id)).filter(Boolean);
                return ok({ items: hydrated });
            }
            if (method === 'POST' && segments[1] === 'add') {
                if (!favs.includes(body.productId)) favs.push(body.productId);
                ls.set(STORAGE.favorites, favs);
                return ok({ items: favs });
            }
            if (method === 'DELETE') {
                const id = segments[2];
                ls.set(STORAGE.favorites, favs.filter((f) => f !== id));
                return ok({ items: favs.filter((f) => f !== id) });
            }
        }

        // ---- /orders ----
        if (root === 'orders') {
            const orders = ls.get(STORAGE.orders, []);
            if (method === 'GET') return ok(orders);
            if (method === 'POST' && segments[1] === 'create') {
                const cart = ls.get(STORAGE.cart, []);
                if (!cart.length) return err('Cart is empty', 400);
                const items = cart.map((it) => ({
                    productId: it.productId, name: it.name, price: it.price,
                    image: it.image, category: it.category,
                    size: it.size, color: it.color, quantity: it.quantity
                }));
                const total = items.reduce((s, it) => s + it.price * it.quantity, 0);
                const order = {
                    _id: 'order_' + Date.now(),
                    items, total, status: 'pending',
                    shippingAddress: body.shippingAddress || {},
                    createdAt: new Date().toISOString()
                };
                orders.unshift(order);
                ls.set(STORAGE.orders, orders);
                ls.set(STORAGE.cart, []);
                return ok(order);
            }
        }

        // ---- /auth ----
        if (root === 'auth') {
            if (segments[1] === 'signup' || segments[1] === 'login') {
                const user = {
                    _id: 'demo_user',
                    name: body.name || (body.email ? body.email.split('@')[0] : 'Demo User'),
                    email: body.email || 'demo@trynova.local'
                };
                ls.set(STORAGE.user, user);
                const token = 'demo_token_' + Date.now();
                return ok({ ...user, token });
            }
            if (segments[1] === 'me') {
                const user = ls.get(STORAGE.user, null);
                if (!user) return err('Not signed in', 401);
                return ok(user);
            }
        }

        // ---- /tryon ----
        // Server-side try-on isn't reachable in demo mode; browser-side
        // engine in tryOn.js handles photo rendering. Return failure so the
        // caller falls back to placeholder.
        if (root === 'tryon') {
            return err('Server try-on unavailable in demo mode', 503);
        }

        // ---- /stylist ----
        if (root === 'stylist') {
            const sample = products.slice().sort(() => 0.5 - Math.random()).slice(0, 6);
            return ok(sample);
        }

        return err('Demo endpoint not implemented: ' + method + ' ' + endpoint, 404);
    }

    let demoModeEnabled = false;
    function enable() {
        if (demoModeEnabled) return;
        demoModeEnabled = true;
        console.info('[TryNova] Backend unreachable — switched to local demo mode.');
        // Subtle UI hint.
        try {
            const banner = document.createElement('div');
            banner.style.cssText =
                'position:fixed;bottom:14px;left:14px;background:#2D241E;color:#EBE1D7;' +
                'font:600 11px Inter,sans-serif;letter-spacing:1px;text-transform:uppercase;' +
                'padding:8px 14px;border-radius:999px;box-shadow:0 4px 12px rgba(0,0,0,.25);' +
                'z-index:9999;opacity:.92;pointer-events:none;';
            banner.textContent = '🟢 Demo mode · local data';
            if (document.body) document.body.appendChild(banner);
            else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(banner));
        } catch (e) {/* ignore */}
    }
    function isEnabled() { return demoModeEnabled; }

    global.TryNovaDemo = { handle, enable, isEnabled, loadProducts };
})(window);
