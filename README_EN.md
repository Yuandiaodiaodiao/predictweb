# Predict.fun Trading App

A trading application based on [Predict.fun](https://predict.fun) prediction markets, supporting market browsing, wallet connection, trading, and position management.

## ✨ Features

- 📊 **Market Browsing** - View all prediction markets and their status
- 📖 **Order Book** - Real-time display of buy/sell order depth
- 💹 **Trading** - Support for limit and market orders
- 📋 **Order Management** - View and cancel pending orders
- 💼 **Position Tracking** - Display current positions and P&L

## 📁 Project Structure

```
predict-fun-trading/
├── backend/                    # Express.js backend proxy service
│   ├── server.js               # Main server file
│   ├── package.json
│   └── .env                    # Environment variables (create manually)
├── frontend/                   # React + Vite frontend application
│   ├── src/
│   │   ├── App.jsx             # Main application component
│   │   ├── App.css             # Global styles
│   │   └── components/
│   │       ├── MarketList.jsx  # Market list component
│   │       ├── TradeModal.jsx  # Trading modal (limit/market orders)
│   │       ├── WalletConnect.jsx # Wallet connection component
│   │       ├── OrderBook.jsx   # Order book component
│   │       ├── Orders.jsx      # Orders list component
│   │       └── Positions.jsx   # Positions component
│   └── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- MetaMask wallet
- Predict.fun API Key

### Install Node.js 20.x (LTS)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node -v
npm -v
```

### 1. Get API Key

1. Visit [Predict.fun](https://predict.fun)
2. Register/Login to your account
3. Get API Key from developer settings

### 2. Configure Backend

```bash
# Enter backend directory
cd backend

# Install dependencies
npm install

# Create environment variables file
cp .env.example .env
```

Edit `.env` file:

```env
# Server port
PORT=3485

# API Base URL (mainnet)
API_BASE_URL=https://api.predict.fun

# Your API Key (required)
PREDICT_API_KEY=your_api_key_here
```

### 3. Configure Frontend

```bash
# Enter frontend directory
cd frontend

# Install dependencies
npm install
```

### 4. Start Application

```bash
# Terminal 1 - Start backend
cd backend
npm run dev

# Terminal 2 - Start frontend
cd frontend
npm run dev
```

### 5. Access Application

- Frontend: http://localhost:5173
- Backend API: http://localhost:3485
- Health Check: http://localhost:3485/api/health

## 📖 API Endpoints

The backend provides the following proxy endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check, verify API Key configuration |
| `/api/markets` | GET | Get market list |
| `/api/markets/:marketId` | GET | Get market details |
| `/api/orderbook/:marketId` | GET | Get order book |
| `/api/auth/message` | GET | Get authentication message |
| `/api/auth` | POST | Get JWT Token |
| `/api/account` | GET | Get account info (auth required) |
| `/api/account/referral` | POST | Set referral code (auth required) |
| `/api/orders` | GET | Get orders list (auth required) |
| `/api/orders` | POST | Create order (auth required) |
| `/api/orders/remove` | POST | Cancel order (auth required) |
| `/api/positions` | GET | Get positions (auth required) |

## 🔧 Features Description

### ✅ Implemented Features

- ✅ View prediction market list
- ✅ Market categories and status display
- ✅ JWT authentication flow
- ✅ Real-time order book display
- ✅ Limit order creation and submission
- ✅ Market order creation and submission
- ✅ Orders list view
- ✅ Order cancellation
- ✅ Position tracking
- ✅ P&L calculation

## 📦 Dependencies

### Backend
- express - Web framework
- axios - HTTP client
- cors - Cross-origin support
- compression - Gzip compression
- dotenv - Environment variables

### Frontend
- react - UI framework
- vite - Build tool
- axios - HTTP client
- ethers - Ethereum library
- @predictdotfun/sdk - Predict.fun official SDK

## 📚 References

- [Predict.fun API Documentation](https://dev.predict.fun)

## 📄 License

MIT License
