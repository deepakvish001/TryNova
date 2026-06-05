const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('../models/Product.model');

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trynova');
        console.log('MongoDB connected for updating images...');
        
        const products = await Product.find({});
        for (let p of products) {
            let img = 'tshirt.png';
            if (p.category === 'Shirts') img = 'shirt.png';
            if (p.category === 'Hoodies') img = 'hoodie.png';
            if (p.category === 'Jackets') img = 'jacket.png';
            if (p.category === 'Jeans') img = 'jeans.png';
            if (p.category === 'Dresses') img = 'dress.png';
            
            p.images = [
                `images/categories/${img}`,
                `images/categories/${img}`
            ];
            await p.save();
        }
        console.log('Updated all products with local category images.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
