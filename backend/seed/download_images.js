const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const https = require('https');
const Product = require('../models/Product.model');

dotenv.config();

const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        // Sanitize URL for single quotes
        const safeUrl = url.replace(/'/g, '');
        https.get(safeUrl, (res) => {
            if (res.statusCode === 200) {
                const stream = fs.createWriteStream(filepath);
                res.pipe(stream);
                stream.on('finish', () => resolve(true));
                stream.on('error', reject);
            } else {
                reject(new Error(`Failed to download: ${res.statusCode}`));
            }
        }).on('error', reject);
    });
};

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trynova');
        console.log('MongoDB connected for image downloading...');
        
        const products = await Product.find({});
        const imagesDir = path.join(__dirname, '../../frontend/images/products');
        
        console.log(`Found ${products.length} products. Downloading images...`);

        // Use a simple concurrency control
        const limit = 1;
        let index = 0;

        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

        const processNext = async () => {
            if (index >= products.length) return;
            const p = products[index++];

            try {
                const img1Path = path.join(imagesDir, `${p._id}_1.jpg`);
                const img2Path = path.join(imagesDir, `${p._id}_2.jpg`);
                
                const query1 = `Fashion product shot of ${p.name.replace(/ /g, '%20')}`;
                const query2 = `Fashion model wearing ${p.name.replace(/ /g, '%20')}`;

                await downloadImage(`https://image.pollinations.ai/prompt/${query1}?width=400&height=500&nologo=true`, img1Path);
                await downloadImage(`https://image.pollinations.ai/prompt/${query2}?width=400&height=500&nologo=true`, img2Path);

                p.images = [
                    `images/products/${p._id}_1.jpg`,
                    `images/products/${p._id}_2.jpg`
                ];
                await p.save();
                console.log(`Saved images for ${p.name}`);
            } catch (err) {
                console.error(`Error for ${p.name}:`, err.message);
                p.images = [
                    `https://picsum.photos/seed/${p._id}/400/500`,
                    `https://picsum.photos/seed/${p._id}_alt/400/500`
                ];
                await p.save();
            }

            await delay(2000); // 2 second delay to avoid 429
            await processNext();
        };

        const workers = [];
        for (let i = 0; i < limit; i++) {
            workers.push(processNext());
        }

        await Promise.all(workers);

        console.log('Finished downloading all images and updating DB.');
        mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
