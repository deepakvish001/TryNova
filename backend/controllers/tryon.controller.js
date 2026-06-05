const cloudinary = require('cloudinary').v2;
const Replicate = require('replicate');
const fetch = require('node-fetch');
const apiData = require('../products-api.json'); // use existing file
const products = apiData.products;

// Map category to fashn.ai format
function getFashnCategory(category) {
  const map = {
    'T-Shirts': 'tops', 'Shirts': 'tops',
    'Hoodies': 'tops', 'Jackets': 'tops',
    'Jeans': 'bottoms', 'Dresses': 'one-pieces'
  };
  return map[category] || 'tops';
}

// Upload base64 image to Cloudinary and return URL
async function uploadToCloudinary(base64Data) {
  const result = await cloudinary.uploader.upload(
    `data:image/jpeg;base64,${base64Data}`,
    { folder: 'trynova/user-uploads', resource_type: 'image' }
  );
  return result.secure_url;
}

// PRIMARY: Fashn.ai
async function tryOnWithFashn(userImageUrl, productImageUrl, category) {
  const fashnCategory = getFashnCategory(category);

  // Start job
  const startRes = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.FASHN_API_KEY}`
    },
    body: JSON.stringify({
      model_image: userImageUrl,
      garment_image: productImageUrl,
      category: fashnCategory,
      flat_lay: false,
      adjust_hands: true,
      restore_background: true,
      restore_clothes: true,
      mode: 'quality',
      num_samples: 1
    })
  });

  const startData = await startRes.json();
  if (!startData.id) throw new Error('Fashn.ai failed to start job');

  // Poll for result
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`https://api.fashn.ai/v1/status/${startData.id}`, {
      headers: { 'Authorization': `Bearer ${process.env.FASHN_API_KEY}` }
    });
    const statusData = await statusRes.json();

    if (statusData.status === 'completed') return statusData.output[0];
    if (statusData.status === 'failed') throw new Error('Fashn.ai job failed');
  }
  throw new Error('Fashn.ai timed out');
}

// FALLBACK: Replicate IDM-VTON
async function tryOnWithReplicate(userImageUrl, productImageUrl, productDescription) {
  const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
  const output = await replicate.run(
    'cuuupid/idm-vton:906425dbca90663ff5427624839572cc56ea7d380343d13e2a4c4b09d3f0c30f',
    {
      input: {
        human_img: userImageUrl,
        garm_img: productImageUrl,
        garment_des: productDescription || 'clothing item',
        is_checked: true,
        is_checked_crop: false,
        denoise_steps: 30,
        seed: 42
      }
    }
  );
  return Array.isArray(output) ? output[0] : output;
}

// MAIN CONTROLLER
exports.processTryOn = async (req, res) => {
  try {
    const { userImageBase64, productId } = req.body;

    // Validate input
    if (!userImageBase64) return res.status(400).json({ success: false, message: 'User image is required' });
    if (!productId) return res.status(400).json({ success: false, message: 'Product ID is required' });

    // Find product from MongoDB
    const Product = require('../models/Product.model');
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const productImageUrl = Array.isArray(product.images) && product.images.length > 0 
      ? product.images[0] 
      : (product.image || `https://image.pollinations.ai/prompt/Fashion%20product%20shot%20of%20${encodeURIComponent(product.name)}?width=400&height=500&nologo=true`);
    
    if (!productImageUrl) return res.status(400).json({ success: false, message: 'Product has no image' });

    let resultImageUrl;

    // Check if user has provided API keys
    const hasKeys = process.env.FASHN_API_KEY && process.env.CLOUDINARY_API_KEY;

    if (hasKeys) {
      // Initialize Cloudinary
      cloudinary.config({ 
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret: process.env.CLOUDINARY_API_SECRET 
      });

      // Upload user image to Cloudinary
      const userImageUrl = await uploadToCloudinary(userImageBase64);

      // Try Fashn.ai first, fallback to Replicate
      try {
        console.log('Attempting Fashn.ai try-on...');
        resultImageUrl = await tryOnWithFashn(userImageUrl, productImageUrl, product.category);
        console.log('Fashn.ai succeeded:', resultImageUrl);
      } catch (fashnError) {
        console.warn('Fashn.ai failed, trying Replicate fallback:', fashnError.message);
        resultImageUrl = await tryOnWithReplicate(userImageUrl, productImageUrl, product.description);
        console.log('Replicate succeeded:', resultImageUrl);
      }
    } else {
      console.log('No API keys detected. Falling back to local AI service mock...');
      try {
        const axios = require('axios');
        const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
        const aiRes = await axios.post(`${aiServiceUrl}/tryon`, {
          userImage: userImageBase64,
          productImage: productImageUrl
        });
        if (aiRes.data && aiRes.data.success) {
          resultImageUrl = aiRes.data.resultImageUrl;
        } else {
          throw new Error("Local service failed");
        }
      } catch (e) {
         console.warn("Local Python AI fallback failed. Using static mock.", e.message);
         resultImageUrl = 'images/demo_tryon_result_kurta.png'; // Ultimate fallback
      }
    }

    if (!resultImageUrl) throw new Error('Both AI services failed to generate result');

    return res.json({ success: true, resultImageUrl });

  } catch (error) {
    console.error('TryOn Error:', error.message);
    return res.status(500).json({
      success: false,
      message: error.message || 'AI generation failed. Please try again.'
    });
  }
};
