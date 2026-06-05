const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product.model');

dotenv.config();

// ---------------------------------------------------------------------------
// Catalogue (expanded — 180+ products spread across 8 categories)
// ---------------------------------------------------------------------------
const T_SHIRTS_MEN = [
    'Zara Textured Relaxed Fit T-Shirt', "H&M Blank Staples Heavyweight Tee",
    'ASOS DESIGN Oversized Heavyweight T-Shirt', 'Uniqlo U AIRism Cotton Oversized T-Shirt',
    'Myntra Roadster Graphic Print Drop Shoulder Tee', 'Nike Sportswear Premium Essentials Tee',
    'Carhartt WIP Chase T-Shirt', "Levi's Batwing Logo Graphic Tee",
    'Puma Classics Oversized T-Shirt', 'Mango Man Organic Cotton Basics Tee',
    'Champion Heritage Logo Tee', 'Tommy Hilfiger Flag Crew Tee',
    'Adidas Originals Trefoil Tee', 'Under Armour Tech 2.0 Tee'
];
const T_SHIRTS_WOMEN = [
    'Zara Seamless Cropped Top', "H&M Rib-Knit Baby Tee",
    'Urban Outfitters BDG Graphic Shrunken Tee', 'SKIMS Cotton Jersey T-Shirt',
    'Myntra Berrylush Ruched Detail Top', 'ASOS DESIGN Curve Boxy T-Shirt',
    'Uniqlo Ribbed Cropped Henley', 'Mango Textured Knit T-Shirt',
    'Nike Dri-FIT One Luxe Top', 'Pull&Bear Retro Print Halter Tee',
    'Forever 21 Square Neck Crop', 'Reformation Boyfriend Tee'
];
const SHIRTS_MEN = [
    'Zara Geometric Print Resort Shirt', "H&M Linen-Blend Grandad Shirt",
    'Mango Man Slim Fit Oxford Shirt', 'ASOS DESIGN Relaxed Satin Shirt',
    'Myntra Highlander Casual Checked Shirt', 'Uniqlo Premium Linen Long Sleeve Shirt',
    'Levis Barstow Western Denim Shirt', 'Tommy Hilfiger Classic Poplin Shirt',
    'Polo Ralph Lauren Custom Fit Oxford', 'Arrow Slim Fit Formal Shirt'
];
const SHIRTS_WOMEN = [
    'Zara Satin Effect Wrap Shirt', "H&M Oversized Cotton Poplin Shirt",
    'Mango Bow Detail Flowy Blouse', 'Urban Outfitters UO Sheer Ruffle Shirt',
    'Myntra SASSAFRAS Balloon Sleeve Top', 'ASOS DESIGN Plunge Front Tie Blouse',
    'Uniqlo Rayon Long Sleeve Blouse', 'Mango Linen Boyfriend Shirt'
];
const HOODIES_MEN = [
    'Nike Tech Fleece Full-Zip Hoodie', 'Zara Plush Jersey Oversized Hoodie',
    "H&M Blank Staples Relaxed Hoodie", 'Adidas Originals Trefoil Essential Hoodie',
    'Carhartt WIP Hooded Chase Sweatshirt', 'Myntra HRX Active Lifestyle Pullover',
    'Puma Downtown Graphic Hoodie', 'Champion Reverse Weave Pullover Hoodie',
    'The North Face Box NSE Hoodie', 'Jordan Essentials Fleece Hoodie'
];
const HOODIES_UNISEX = [
    'Essentials Fear of God Pullover Hoodie', 'Gap Arch Logo Vintage Soft Hoodie',
    "H&M Motif-Detail Oversized Hoodie", 'ASOS DESIGN Unisex Oversized Hoodie',
    'Uniqlo Pullover Long Sleeve Hoodie', 'Stussy Basic Logo Applique Hoodie',
    'Vans Classic V Pullover Hoodie', 'Supreme Box Logo Hooded Sweatshirt'
];
const JACKETS_MEN = [
    'Zara Faux Leather Biker Jacket', 'The North Face Nuptse Puffer Jacket',
    "H&M Padded Aviator Jacket", "Levi's Type III Sherpa Trucker Jacket",
    'Mango Man Suede Effect Bomber', 'Nike Windrunner Hooded Jacket',
    'ASOS DESIGN Borg Collar Harrington Jacket', 'Myntra Roadster Denim Utility Jacket',
    'Patagonia Down Sweater Jacket', 'Columbia Watertight II Rain Jacket'
];
const JACKETS_WOMEN = [
    'Zara Cropped Faux Leather Jacket', "H&M Double-Breasted Trench Coat",
    'Mango Oversized Wool Blend Coat', 'The North Face Retro Nuptse Cropped Puffer',
    'Urban Outfitters BDG Corduroy Jacket', 'ASOS DESIGN Brushed Bomber Jacket',
    'Myntra Tokyo Talkies Puffer Jacket', 'Free People Denim Jacket'
];
const JEANS_MEN = [
    "Levi's 501 Original Fit Jeans", 'Zara Wide Leg Relaxed Fit Jeans',
    "H&M Straight Regular Jeans", 'ASOS DESIGN Baggy Y2K Jeans',
    'Mango Man Tapered Cropped Jeans', 'Uniqlo Selvedge Regular Fit Jeans',
    'Myntra WROGN Distressed Skinny Jeans', 'Diesel D-Strukt Slim Fit Jeans',
    'Wrangler Texas Stretch Jeans', 'Calvin Klein Slim Tapered Jeans'
];
const JEANS_WOMEN = [
    'Zara High Waist Wide Leg Jeans', "Levi's Ribcage Straight Ankle Jeans",
    "H&M 90s Baggy High Jeans", 'Urban Outfitters BDG Cowboy Flare Jeans',
    'Mango Flared High Waist Jeans', 'ASOS DESIGN Curve Mom Jeans',
    'Myntra Roadster Bootcut Stretch Jeans', 'Agolde 90s Pinch Waist'
];
const DRESSES_WOMEN = [
    'Zara Draped Satin Midi Dress', "H&M Rib-Knit Bodycon Dress",
    'Mango Floral Print Flowy Dress', 'ASOS DESIGN Bias Cut Maxi Slip Dress',
    'Urban Outfitters UO Corset Detail Mini', 'House of CB Embellished Corset Dress',
    'Myntra Berrylush Tie-Up Detail Maxi', 'Zara Cut-Out Linen Blend Dress',
    "H&M Smocked Bodice Sundress", 'Mango Ruched Velvet Party Dress',
    'ASOS EDITION Pearl Embellished Mini', 'Reformation Juliette High Slit Dress',
    'Skims Soft Lounge Slip Dress', 'Myntra SASSAFRAS Tiered Ruffle Dress',
    'Zara Asymmetric Knit Midi Dress', "H&M Crepe Wrap Dress",
    'Mango Sequined Shift Dress', 'Urban Outfitters Babydoll Mini Dress',
    'ASOS DESIGN Cowl Neck Midi Dress', 'Myntra Athena Lace Overlay Dress'
];
const SNEAKERS = [
    { name: 'Nike Air Force 1 Low', gender: 'Unisex' },
    { name: 'Adidas Samba OG', gender: 'Unisex' },
    { name: 'New Balance 550 White Green', gender: 'Unisex' },
    { name: 'Converse Chuck 70 High Top', gender: 'Unisex' },
    { name: 'Vans Old Skool Classic', gender: 'Unisex' },
    { name: 'Puma Suede Classic XXI', gender: 'Unisex' },
    { name: 'Asics Gel-Lyte III OG', gender: 'Men' },
    { name: 'Nike Dunk Low Panda', gender: 'Women' },
    { name: 'Reebok Club C 85 Vintage', gender: 'Unisex' },
    { name: 'On Cloud 5 Running Shoes', gender: 'Men' },
    { name: 'Adidas Stan Smith Primegreen', gender: 'Women' },
    { name: 'Jordan 1 Mid Bred Toe', gender: 'Men' }
];
const ACCESSORIES = [
    { name: 'Ray-Ban Wayfarer Classic Sunglasses', gender: 'Unisex' },
    { name: 'Fossil Gen 6 Smartwatch', gender: 'Unisex' },
    { name: 'Carhartt Acrylic Watch Hat', gender: 'Unisex' },
    { name: "Levi's Reversible Leather Belt", gender: 'Men' },
    { name: 'Coach Tabby Crossbody Bag', gender: 'Women' },
    { name: 'Nike Heritage Crossbody Bag', gender: 'Unisex' },
    { name: 'New Era 9FORTY Cap', gender: 'Unisex' },
    { name: 'Hermès Silk Scarf 90', gender: 'Women' },
    { name: 'Daniel Wellington Classic Petite Watch', gender: 'Women' },
    { name: 'Casio G-Shock Digital Watch', gender: 'Men' }
];

const COLOR_PALETTE = [
    'Black', 'White', 'Navy', 'Olive', 'Maroon', 'Beige', 'Grey', 'Pink',
    'Mustard', 'Teal', 'Charcoal', 'Sage', 'Cream', 'Rust', 'Lilac'
];

const TAG_BANK = {
    'T-Shirts': ['casual', 'everyday', 'cotton', 'minimal'],
    'Shirts': ['workwear', 'smart-casual', 'office', 'evening'],
    'Hoodies': ['streetwear', 'athleisure', 'cozy', 'oversized'],
    'Jackets': ['outerwear', 'winter', 'layering', 'statement'],
    'Jeans': ['denim', 'everyday', 'staple', 'streetwear'],
    'Dresses': ['party', 'date-night', 'brunch', 'elegant'],
    'Sneakers': ['streetwear', 'athleisure', 'classic', 'iconic'],
    'Accessories': ['finishing-touch', 'statement', 'everyday', 'gift']
};

const getColors = () => {
    const n = Math.floor(Math.random() * 3) + 2; // 2-4
    return [...COLOR_PALETTE].sort(() => 0.5 - Math.random()).slice(0, n);
};

const getSizes = (category) => {
    if (category === 'Jeans') return ['28', '30', '32', '34', '36', '38'];
    if (category === 'Sneakers') return ['6', '7', '8', '9', '10', '11', '12'];
    if (category === 'Accessories') return ['One Size'];
    return ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
};

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const priceFor = (category) => {
    const ranges = {
        'T-Shirts': [499, 2499],
        'Shirts': [999, 3999],
        'Hoodies': [1499, 5999],
        'Jackets': [2499, 12999],
        'Jeans': [1499, 6999],
        'Dresses': [1799, 8999],
        'Sneakers': [2999, 14999],
        'Accessories': [499, 9999]
    };
    const [lo, hi] = ranges[category] || [499, 4999];
    return randInt(lo, hi);
};

const getRating = () => parseFloat((Math.random() * 1.5 + 3.5).toFixed(1));
const getDiscount = () => (Math.random() < 0.4 ? randInt(10, 50) : 0);

const brandFromName = (name) => name.split(' ').slice(0, 1)[0];

const generateProducts = () => {
    const products = [];
    let idCounter = 1;

    const addProduct = (name, category, gender) => {
        const tags = [
            category.toLowerCase(),
            gender.toLowerCase(),
            ...TAG_BANK[category].slice(0, 2)
        ];
        if (Math.random() < 0.3) tags.push('trending');
        if (Math.random() < 0.2) tags.push('new-arrival');

        products.push({
            name,
            brand: brandFromName(name),
            category,
            gender,
            price: priceFor(category),
            discount: getDiscount(),
            popularity: randInt(0, 1000),
            images: [
                `https://picsum.photos/seed/trynova_${idCounter}/400/500`,
                `https://picsum.photos/seed/trynova_alt_${idCounter}/400/500`
            ],
            description: `${name} - crafted with premium materials and modern aesthetics. A versatile addition to your wardrobe designed for both comfort and style.`,
            sizes: getSizes(category),
            colors: getColors(),
            stock: randInt(10, 80),
            rating: getRating(),
            tags
        });
        idCounter++;
    };

    T_SHIRTS_MEN.forEach((n) => addProduct(n, 'T-Shirts', 'Men'));
    T_SHIRTS_WOMEN.forEach((n) => addProduct(n, 'T-Shirts', 'Women'));
    SHIRTS_MEN.forEach((n) => addProduct(n, 'Shirts', 'Men'));
    SHIRTS_WOMEN.forEach((n) => addProduct(n, 'Shirts', 'Women'));
    HOODIES_MEN.forEach((n) => addProduct(n, 'Hoodies', 'Men'));
    HOODIES_UNISEX.forEach((n) => addProduct(n, 'Hoodies', 'Unisex'));
    JACKETS_MEN.forEach((n) => addProduct(n, 'Jackets', 'Men'));
    JACKETS_WOMEN.forEach((n) => addProduct(n, 'Jackets', 'Women'));
    JEANS_MEN.forEach((n) => addProduct(n, 'Jeans', 'Men'));
    JEANS_WOMEN.forEach((n) => addProduct(n, 'Jeans', 'Women'));
    DRESSES_WOMEN.forEach((n) => addProduct(n, 'Dresses', 'Women'));
    SNEAKERS.forEach(({ name, gender }) => addProduct(name, 'Sneakers', gender));
    ACCESSORIES.forEach(({ name, gender }) => addProduct(name, 'Accessories', gender));

    return products;
};

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trynova');
        console.log('MongoDB connected for seeding...');

        await Product.deleteMany({});
        console.log('Cleared existing products.');

        const products = generateProducts();
        await Product.insertMany(products);
        console.log(`Successfully seeded ${products.length} products across 8 categories.`);

        const breakdown = {};
        products.forEach((p) => { breakdown[p.category] = (breakdown[p.category] || 0) + 1; });
        console.table(breakdown);

        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

if (require.main === module) {
    seedDB();
}

module.exports = { generateProducts };
