# LS-LMSR Prediction Market

An implementation of a Liquidity-Sensitive Logarithmic Market Scoring Rule (LS-LMSR) prediction market on EVM-based chains. This project features an exponentially scaling liquidity parameter that adapts to trading volume, deployed on Base Sepolia testnet.

## 🎯 Overview

This prediction market uses the LS-LMSR mechanism where the liquidity parameter `b` scales exponentially with trading volume:

```
b = b₀ × exp(α × Q)
```

Where:
- `b₀` is the base liquidity parameter
- `α` is the sensitivity parameter
- `Q` is the cumulative trading volume

## 🏗️ Architecture

- **Smart Contract**: Solidity 0.8.20 with custom math library for ln/exp calculations
- **Frontend**: React + Vite + TailwindCSS + RainbowKit + Wagmi v2
- **Deployment**: Base Sepolia Testnet
- **Contract Address**: `0x631bd842064962E084cDc6Db0D47679e4C19982C`

## 📋 Prerequisites

- Node.js v16+ and npm
- MetaMask or compatible Web3 wallet
- Base Sepolia testnet ETH ([Get from faucet](https://bridge.base.org/))

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd lslmsr-market
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env` file in the root directory:

```env
# Required for deployment/interaction
PRIVATE_KEY=your_private_key_here
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
ETHERSCAN_API_KEY=your_etherscan_api_key

# Optional
SEPOLIA_RPC_URL=https://rpc.sepolia.org
```

### 4. Compile Contract

```bash
npx hardhat compile
```

### 5. Run Tests

```bash
npx hardhat test
```

Expected output:
```
  LSLMSRMarket
    Deployment
      ✔ Should deploy with correct parameters
      ✔ Should initialize with zero quantities
      ✔ Should reject invalid number of outcomes
    Trading - Buying Shares
      ✔ Should allow buying shares with correct payment
      ✔ Should reject insufficient payment
    ...
  ✔ 40+ passing tests
```

## 🎮 Using the Application

### Deploy New Contract (Optional)

The contract is already deployed on Base Sepolia. To deploy your own:

```bash
npx hardhat run scripts/deploy.js --network baseSepolia
```

This will:
- Deploy the contract with parameters (2 outcomes, b₀=0.01 ETH, α=0.01)
- Calculate and provide required initial funding
- Save deployment info to `./deployments/`
- Display contract address and market information

### Interact via Scripts

Test the deployed contract:

```bash
npx hardhat run scripts/interact.js --network baseSepolia
```

This script demonstrates:
- Reading market parameters
- Calculating trade costs
- Checking user balances
- Price impact analysis
- LS-LMSR formula verification

### Verify Contract (Optional)

```bash
npx hardhat run scripts/verify.js --network baseSepolia
```

## 🌐 Run the Frontend

### 1. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

### 3. Connect Wallet

1. Click "Connect Wallet" in the top-right
2. Select your wallet (MetaMask recommended)
3. Switch to Base Sepolia network when prompted
4. Approve the connection

### 4. Start Trading

**Buy Shares:**
1. Select "Buy Shares" tab
2. Choose an outcome (1 or 2)
3. Enter number of shares
4. Review the cost and price impact
5. Click "Execute Buy Order"
6. Confirm transaction in wallet

**Sell Shares:**
1. Select "Sell Shares" tab
2. Choose outcome with shares
3. Enter number of shares to sell
4. Review payout amount
5. Click "Execute Sell Order"
6. Confirm transaction in wallet

## 📊 Features

### Smart Contract Features

✅ **LS-LMSR Implementation**
- Exponential liquidity scaling: `b = b₀ × exp(α × Q)`
- Accurate price calculation using custom ln/exp functions
- Cost function: `C(q) = b × ln(Σ exp(qᵢ/b))`

✅ **Trading Mechanics**
- Buy/sell outcome shares with automatic pricing
- Cumulative volume tracking
- Price normalization (prices always sum to 1)
- Refund of excess payment

✅ **Market Resolution**
- Owner can resolve market with winning outcome
- Winners can claim 1 ETH per winning share
- Trading disabled after resolution

✅ **Gas Optimized**
- Efficient storage patterns
- Optimized math operations
- ~400k gas for trades

### Frontend Features

✅ **Real-time Market Data**
- Live price display for all outcomes
- Current quantities and user holdings
- Dynamic liquidity parameter (b)
- Total trading volume

✅ **Interactive Trading**
- Buy/sell interface with instant cost calculation
- Price impact preview
- Transaction status updates
- Error handling with user feedback

✅ **Visualization**
- Price history chart using Recharts
- Progress bars for outcome probabilities
- Color-coded outcomes
- Responsive design

✅ **Web3 Integration**
- RainbowKit for wallet connection
- Wagmi v2 for contract interactions
- Support for multiple wallets
- Network switching

## 🧪 Testing

### Run Full Test Suite

```bash
npx hardhat test
```

### Run Specific Test File

```bash
npx hardhat test test/LMSR.test.js
```

### Test Coverage

The test suite includes:
- Deployment validation
- Price calculation accuracy
- Trading mechanics (buy/sell)
- Volume tracking
- Market resolution
- Multi-outcome markets
- Edge cases and error handling
- Gas optimization verification
- Mathematical correctness

### Gas Usage

Typical gas costs:
- Deployment: ~3M gas
- Buy shares: ~400k gas
- Sell shares: ~350k gas
- Resolve market: ~50k gas

## 📖 Contract API

### Core Functions

**Trading:**
```solidity
function getTradeCost(uint256 outcome, int256 delta) 
    returns (int256 cost, uint256[] memory newPrices)

// Delta positive = buy, negative = sell
```

**Market Info:**
```solidity
function getPrices() returns (uint256[] memory)
function getB() returns (uint256)
function getMarketInfo() returns (...)
```

**User Balances:**
```solidity
function getUserBalance(address user, uint256 outcome) returns (uint256)
function getAllUserBalances(address user) returns (uint256[] memory)
```

**Resolution:**
```solidity
function resolveMarket(uint256 winningOutcome) // Owner only
function claimWinnings() // After resolution
```

## 🔧 Project Structure

```
lslmsr-market/
├── contracts/
│   └── LMSR.sol              # Main contract with LS-LMSR implementation
├── scripts/
│   ├── deploy.js             # Deployment script
│   ├── interact.js           # Interaction examples
│   └── verify.js             # Contract verification
├── test/
│   └── LMSR.test.js          # Comprehensive test suite
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main React component
│   │   ├── config.js         # Contract ABI and address
│   │   ├── wagmi.config.js   # Web3 configuration
│   │   └── main.jsx          # App entry point
│   ├── index.html
│   └── package.json
├── hardhat.config.js
├── package.json
└── README.md
```

## 🎓 How It Works

### LS-LMSR Formula

The cost to move from quantities `q` to `q'` is:

```
Cost = C(q') - C(q)
where C(q) = b × ln(Σᵢ exp(qᵢ/b))
```

### Liquidity Scaling

As trading volume increases, liquidity grows:
- **Low volume**: `b ≈ b₀` (steep price curves, high slippage)
- **High volume**: `b >> b₀` (flat price curves, low slippage)

This creates a market that:
1. Starts with responsive prices for early traders
2. Becomes more stable as confidence builds
3. Rewards market makers with better pricing

### Price Calculation

Prices are derived from the cost function gradient:

```
Price(i) = ∂C/∂qᵢ = exp(qᵢ/b) / Σⱼ exp(qⱼ/b)
```

Prices always sum to 1, representing probabilities.

## 🐛 Troubleshooting

### Common Issues

**"Insufficient funds" error:**
- Get Base Sepolia ETH from [Base Bridge](https://bridge.base.org/)

**"Network mismatch" error:**
- Switch MetaMask to Base Sepolia
- Chain ID: 84532

**Transaction fails:**
- Increase gas limit in MetaMask
- Ensure you have enough ETH for gas + trade cost

**Prices not updating:**
- Click "Refresh" button in UI
- Wait for transaction confirmation

**Can't sell shares:**
- Verify you own shares in that outcome
- Check you're not trying to sell more than you own

## 📚 Additional Resources

- [LS-LMSR Paper](https://www.cs.cmu.edu/~./jcl/papers/LMSR/LMSR.pdf)
- [Base Sepolia Explorer](https://sepolia.basescan.org/)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Wagmi Documentation](https://wagmi.sh/)

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- **Deployed Contract**: [BaseScan](https://sepolia.basescan.org/address/0x631bd842064962E084cDc6Db0D47679e4C19982C)
- **Frontend Demo**: [Live Demo](https://lsmr-market.vercel.app/) 

---

Built for the XO.market LS-LMSR Challenge 🚀