# TryNova - AI-Powered Fashion E-commerce

TryNova is a complete production-ready AI-powered fashion web application. It features a modern, premium dark-themed frontend, a scalable Node.js backend, and a Python FastAPI AI microservice for virtual try-ons.

## Features

- **Modern UI**: Dark theme, glassmorphism, responsive mobile-first design.
- **AI Virtual Try-On**: Upload a photo, pick a clothing item, and see yourself wearing it using Replicate's `idm-vton` model (with an OpenCV local fallback).
- **AI Stylist**: A chat interface that recommends outfits based on occasion, vibe, and color preferences.
- **Shop & Filtering**: Browse 100 seeded fashion items with dynamic filtering by category, price, gender, and sorting.
- **User Authentication**: Secure JWT-based login and signup.
- **Cart & Wishlist**: Manage your shopping cart and save favorite items to your profile.

## Prerequisites

- Node.js (v18+)
- Python (v3.10+)
- MongoDB (running locally on port 27017 or adjust `.env` for cloud URI)
- Replicate API Key (Optional, for advanced AI try-on)

## Installation & Setup

### 1. Clone & Install Dependencies
First, install backend dependencies:
```bash
cd backend
npm install
```

Then, set up the AI service:
```bash
cd ../ai-service
pip install -r requirements.txt
```

### 2. Environment Variables
Create a `.env` file in the `/backend` directory based on the `.ENV FILE TEMPLATE` (already created for you):
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/trynova
JWT_SECRET=trynova_super_secret_jwt_key_2026
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
```
In the `/ai-service` directory, export your Replicate token (if using):
```bash
export REPLICATE_API_TOKEN=your_token_here
```

### 3. Seed the Database
Make sure MongoDB is running, then run:
```bash
cd backend
node seed/products.seed.js
```
*This will insert 100 realistic fashion products.*

### 4. Run the Application

**Start the Node.js Backend:**
```bash
cd backend
node server.js
```

**Start the Python AI Service:**
```bash
cd ai-service
uvicorn main:app --reload
```

**Open the Frontend:**
Simply open `frontend/index.html` in your favorite modern web browser or serve it using a local HTTP server:
```bash
cd frontend
npx serve .
```

## API Documentation

### Auth
- `POST /api/auth/signup`: Create a new user
- `POST /api/auth/login`: Login user
- `GET /api/auth/me`: Get current user profile

### Products
- `GET /api/products`: Fetch all products (supports queries: `?category=X&gender=Y&sort=Trending`)
- `GET /api/products/:id`: Get single product details
- `GET /api/products/recommendations?category=X`: Get 4 similar products

### Cart & Favorites
- `GET /api/cart`: Get user's cart
- `POST /api/cart/add`: Add item to cart
- `DELETE /api/cart/remove/:id`: Remove item from cart
- `GET /api/favorites`: Get user's wishlist
- `POST /api/favorites/add`: Add item to wishlist

### AI Services
- `POST /api/tryon`: Processes virtual try-on via AI Service
- `POST /api/stylist`: Returns 6 product suggestions based on user prompt parameters

## Getting a Replicate API Key
1. Go to [Replicate](https://replicate.com/) and sign up.
2. Navigate to your Account > API Tokens.
3. Create a new token and export it as `REPLICATE_API_TOKEN`.

---
*Built for the future of fashion. Try before you buy.*
