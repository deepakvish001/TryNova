const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product.model');

dotenv.config();

const T_SHIRTS_MEN = ["Zara Textured Relaxed Fit T-Shirt", "H&M Blank Staples Heavyweight Tee", "ASOS DESIGN Oversized Heavyweight T-Shirt", "Uniqlo U AIRism Cotton Oversized T-Shirt", "Myntra Roadster Graphic Print Drop Shoulder Tee", "Nike Sportswear Premium Essentials Tee", "Carhartt WIP Chase T-Shirt", "Levi's Batwing Logo Graphic Tee", "Puma Classics Oversized T-Shirt", "Mango Man Organic Cotton Basics Tee"];
const T_SHIRTS_WOMEN = ["Zara Seamless Cropped Top", "H&M Rib-Knit Baby Tee", "Urban Outfitters BDG Graphic Shrunken Tee", "SKIMS Cotton Jersey T-Shirt", "Myntra Berrylush Ruched Detail Top", "ASOS DESIGN Curve Boxy T-Shirt", "Uniqlo Ribbed Cropped Henley", "Mango Textured Knit T-Shirt", "Nike Dri-FIT One Luxe Top", "Pull&Bear Retro Print Halter Tee"];
const SHIRTS_MEN = ["Zara Geometric Print Resort Shirt", "H&M Linen-Blend Grandad Shirt", "Mango Man Slim Fit Oxford Shirt", "ASOS DESIGN Relaxed Satin Shirt", "Myntra Highlander Casual Checked Shirt", "Uniqlo Premium Linen Long Sleeve Shirt", "Levis Barstow Western Denim Shirt", "Tommy Hilfiger Classic Poplin Shirt"];
const SHIRTS_WOMEN = ["Zara Satin Effect Wrap Shirt", "H&M Oversized Cotton Poplin Shirt", "Mango Bow Detail Flowy Blouse", "Urban Outfitters UO Sheer Ruffle Shirt", "Myntra SASSAFRAS Balloon Sleeve Top", "ASOS DESIGN Plunge Front Tie Blouse", "Uniqlo Rayon Long Sleeve Blouse"];
const HOODIES_MEN = ["Nike Tech Fleece Full-Zip Hoodie", "Zara Plush Jersey Oversized Hoodie", "H&M Blank Staples Relaxed Hoodie", "Adidas Originals Trefoil Essential Hoodie", "Carhartt WIP Hooded Chase Sweatshirt", "Myntra HRX Active Lifestyle Pullover", "Puma Downtown Graphic Hoodie", "Champion Reverse Weave Pullover Hoodie"];
const HOODIES_UNISEX = ["Essentials Fear of God Pullover Hoodie", "Gap Arch Logo Vintage Soft Hoodie", "H&M Motif-Detail Oversized Hoodie", "ASOS DESIGN Unisex Oversized Hoodie", "Uniqlo Pullover Long Sleeve Hoodie", "Stussy Basic Logo Applique Hoodie", "Vans Classic V Pullover Hoodie"];
const JACKETS_MEN = ["Zara Faux Leather Biker Jacket", "The North Face Nuptse Puffer Jacket", "H&M Padded Aviator Jacket", "Levi's Type III Sherpa Trucker Jacket", "Mango Man Suede Effect Bomber", "Nike Windrunner Hooded Jacket", "ASOS DESIGN Borg Collar Harrington Jacket", "Myntra Roadster Denim Utility Jacket"];
const JACKETS_WOMEN = ["Zara Cropped Faux Leather Jacket", "H&M Double-Breasted Trench Coat", "Mango Oversized Wool Blend Coat", "The North Face Retro Nuptse Cropped Puffer", "Urban Outfitters BDG Corduroy Jacket", "ASOS DESIGN Brushed Bomber Jacket", "Myntra Tokyo Talkies Puffer Jacket"];
const JEANS_MEN = ["Levi's 501 Original Fit Jeans", "Zara Wide Leg Relaxed Fit Jeans", "H&M Straight Regular Jeans", "ASOS DESIGN Baggy Y2K Jeans", "Mango Man Tapered Cropped Jeans", "Uniqlo Selvedge Regular Fit Jeans", "Myntra WROGN Distressed Skinny Jeans", "Diesel D-Strukt Slim Fit Jeans"];
const JEANS_WOMEN = ["Zara High Waist Wide Leg Jeans", "Levi's Ribcage Straight Ankle Jeans", "H&M 90s Baggy High Jeans", "Urban Outfitters BDG Cowboy Flare Jeans", "Mango Flared High Waist Jeans", "ASOS DESIGN Curve Mom Jeans", "Myntra Roadster Bootcut Stretch Jeans"];
const DRESSES_WOMEN = ["Zara Draped Satin Midi Dress", "H&M Rib-Knit Bodycon Dress", "Mango Floral Print Flowy Dress", "ASOS DESIGN Bias Cut Maxi Slip Dress", "Urban Outfitters UO Corset Detail Mini", "House of CB Embellished Corset Dress", "Myntra Berrylush Tie-Up Detail Maxi", "Zara Cut-Out Linen Blend Dress", "H&M Smocked Bodice Sundress", "Mango Ruched Velvet Party Dress", "ASOS EDITION Pearl Embellished Mini", "Reformation Juliette High Slit Dress", "Skims Soft Lounge Slip Dress", "Myntra SASSAFRAS Tiered Ruffle Dress", "Zara Asymmetric Knit Midi Dress", "H&M Crepe Wrap Dress", "Mango Sequined Shift Dress", "Urban Outfitters Babydoll Mini Dress", "ASOS DESIGN Cowl Neck Midi Dress", "Myntra Athena Lace Overlay Dress"];

const getColors = () => {
    const allColors = ['Black', 'White', 'Navy', 'Olive', 'Maroon', 'Beige', 'Grey', 'Pink', 'Mustard', 'Teal'];
    // pick 2-3 random colors
    const numColors = Math.floor(Math.random() * 2) + 2;
    const shuffled = allColors.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, numColors);
};

const getSizes = (category) => {
    if (category === 'Jeans') return ['28', '30', '32', '34', '36'];
    return ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
};

const getRandomPrice = () => Math.floor(Math.random() * (4999 - 499 + 1)) + 499;
const getRandomRating = () => (Math.random() * (5.0 - 3.5) + 3.5).toFixed(1);

const generateProducts = () => {
    const products = [];
    let idCounter = 1;

    const addProduct = (name, category, gender) => {
        products.push({
            name,
            category,
            gender,
            price: getRandomPrice(),
            images: [`https://picsum.photos/seed/trynova_${idCounter}/400/500`, `https://picsum.photos/seed/trynova_alt_${idCounter}/400/500`],
            description: `This ${name} brings modern aesthetics to your wardrobe. Designed for comfort and style, it features premium quality materials tailored for everyday wear. Upgrade your fashion game instantly.`,
            sizes: getSizes(category),
            colors: getColors(),
            stock: Math.floor(Math.random() * 50) + 10,
            rating: parseFloat(getRandomRating()),
            tags: [category.toLowerCase(), gender.toLowerCase(), 'trending']
        });
        idCounter++;
    };

    // T-Shirts (20)
    T_SHIRTS_MEN.forEach(n => addProduct(n, 'T-Shirts', 'Men'));
    T_SHIRTS_WOMEN.forEach(n => addProduct(n, 'T-Shirts', 'Women'));
    // Shirts (15)
    SHIRTS_MEN.forEach(n => addProduct(n, 'Shirts', 'Men'));
    SHIRTS_WOMEN.forEach(n => addProduct(n, 'Shirts', 'Women'));
    // Hoodies (15)
    HOODIES_MEN.forEach(n => addProduct(n, 'Hoodies', 'Men'));
    HOODIES_UNISEX.forEach(n => addProduct(n, 'Hoodies', 'Unisex'));
    // Jackets (15)
    JACKETS_MEN.forEach(n => addProduct(n, 'Jackets', 'Men'));
    JACKETS_WOMEN.forEach(n => addProduct(n, 'Jackets', 'Women'));
    // Jeans (15)
    JEANS_MEN.forEach(n => addProduct(n, 'Jeans', 'Men'));
    JEANS_WOMEN.forEach(n => addProduct(n, 'Jeans', 'Women'));
    // Dresses (20)
    DRESSES_WOMEN.forEach(n => addProduct(n, 'Dresses', 'Women'));

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
        console.log(`Successfully seeded ${products.length} products.`);

        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedDB();
