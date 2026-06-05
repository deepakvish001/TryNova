const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const Product = require('../models/Product.model');

dotenv.config();

const seedFromJSON = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trynova');
        console.log('MongoDB connected for seeding from JSON...');
        
        await Product.deleteMany({});
        console.log('Cleared existing products.');

        const rawData = fs.readFileSync('/Users/Dell/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/CD3B6D91-2263-4491-8D52-96A61CDA8906/products-api.json', 'utf8');
        const apiData = JSON.parse(rawData);

        const products = apiData.products.map(item => {
            // Map JSON fields to Mongoose Schema fields
            
            let category = item.subcategory;
            if (['Tops', 'Sweatshirts', 'Sweaters'].includes(category)) category = 'Shirts';
            else if (['Bottoms', 'Trousers', 'Shorts', 'Skirts'].includes(category)) category = 'Jeans';
            else if (['Outerwear', 'Jackets'].includes(category)) category = 'Jackets';
            else if (['Formal Wear', 'Ethnic Wear', 'Sets', 'Dresses'].includes(category)) category = 'Dresses';
            else if (['T-Shirts', 'Activewear', 'Innerwear', 'Swimwear', 'Accessories'].includes(category)) category = 'T-Shirts';
            else category = 'T-Shirts'; // Default fallback
            
            const gender = item.category === 'Men' || item.category === 'Women' ? item.category : 'Unisex';
            
            return {
                name: item.name,
                category: category,
                gender: gender,
                price: item.price,
                images: [
                    `https://image.pollinations.ai/prompt/Fashion%20product%20shot%20of%20${encodeURIComponent(item.name)}?width=400&height=500&nologo=true`,
                    `https://image.pollinations.ai/prompt/Fashion%20model%20wearing%20${encodeURIComponent(item.name)}?width=400&height=500&nologo=true`
                ],
                description: `This ${item.name} is made of ${item.fabric}. It's a great addition to your wardrobe.`,
                sizes: item.sizes,
                colors: item.colors,
                stock: item.in_stock ? Math.floor(Math.random() * 50) + 10 : 0,
                rating: parseFloat((Math.random() * (5.0 - 3.5) + 3.5).toFixed(1)),
                tags: [category.toLowerCase(), gender.toLowerCase(), item.fabric.toLowerCase()]
            };
        });

        await Product.insertMany(products);
        console.log(`Successfully seeded ${products.length} products from JSON.`);

        mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
};

seedFromJSON();
