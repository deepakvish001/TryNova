const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// vercel.json routes this API through Vercel's proxy, so req.ip is the
// proxy's address unless we opt in to X-Forwarded-For. Without this the
// auth rate limiters would bucket every client together and throttle
// everyone at once. Trust exactly one hop — `true` would let a caller
// spoof their own address by sending the header themselves.
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/trynova')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// Routes
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/cart', require('./routes/cart.routes'));
app.use('/api/favorites', require('./routes/favorites.routes'));
app.use('/api/tryon', require('./routes/tryon.routes'));
app.use('/api/orders', require('./routes/order.routes'));
app.use('/api/stylist', require('./routes/stylist.routes'));
app.use('/api/recommendations', require('./routes/recommendations.routes'));

// Basic health check route
app.get('/', (req, res) => {
  res.send('TryNova API is running');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message || 'Server Error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
