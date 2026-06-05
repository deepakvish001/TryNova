# TryNova - AI-Powered Fashion E-commerce

TryNova is a production-ready AI-powered fashion web application. It pairs a modern frontend with a Node.js + Express backend and a Python FastAPI AI microservice for virtual try-ons.

## Features

- **Virtual Try-On (3-tier engine):**
  - **Browser mode** — MediaPipe Pose runs entirely in the browser, detects 33 body landmarks, and warps the garment onto the torso. Works **offline, instantly, with zero API cost**.
  - **Live camera mode** — real-time webcam try-on with mirrored pose tracking.
  - **Server mode** — automatic fallback to Python + OpenCV + MediaPipe, or Replicate `idm-vton` / Fashn.ai when keys are provided.
- **Personalized Recommendations** — a weighted profile is built from order history, cart and wishlist signals. Picks reflect the user's preferred category, gender, colour palette and price band.
- **Complete the Look** — anchored on any product or the cart, suggests complementary categories within a sensible price range.
- **Trending** — driven by real order counts, with rating-based top-up.
- **AI Stylist** — chat-style outfit recommendations.
- **Recently Viewed** — browser-local history of viewed products with quick re-entry.
- **AI Insights** — fit notes, styling tips and a confidence score generated for each try-on.
- **Shop & Filtering** — 180+ seeded items across 8 categories, with category / gender / price / brand / search filters.
- **Auth + Cart + Wishlist + Orders** — JWT-based, MongoDB-backed.

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
