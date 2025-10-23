const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying LS-LMSR Market...\n");

  // Deployment parameters
  const NUM_OUTCOMES = 2; // Binary market (Yes/No)
  const B0 = ethers.parseEther("0.01"); // 0.1 base liquidity
  const ALPHA = ethers.parseEther("0.01"); // 0.01 sensitivity parameter

  console.log("Constructor parameters:");
  console.log(`  Number of outcomes: ${NUM_OUTCOMES}`);
  console.log(`  b0: ${ethers.formatEther(B0)} (base liquidity)`);
  console.log(`  alpha: ${ethers.formatEther(ALPHA)} (sensitivity parameter)`);
  console.log("");

  // Calculate required initial funding: b0 * ln(n)
  const lnN = Math.log(NUM_OUTCOMES);
  const initialCostInEth = Number(ethers.formatEther(B0)) * lnN;
  const initialFunding = ethers.parseEther(initialCostInEth.toFixed(18));

  console.log(`  Required initial funding: ${ethers.formatEther(initialFunding)} ETH`);
  console.log(`  Formula: b0 * ln(n) = ${ethers.formatEther(B0)} * ln(${NUM_OUTCOMES}) = ${ethers.formatEther(B0)} * ${lnN.toFixed(6)}`);
  console.log("");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying from address: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < initialFunding) {
    console.error("❌ Insufficient balance for deployment!");
    console.error(`   Need: ${ethers.formatEther(initialFunding)} ETH`);
    console.error(`   Have: ${ethers.formatEther(balance)} ETH`);
    console.error("");
    console.error("Get testnet ETH from:");
    console.error("   Sepolia: https://sepoliafaucet.com/");
    console.error("   Base Sepolia: https://bridge.base.org/");
    process.exit(1);
  }
   console.log(`   Need: ${ethers.formatEther(initialFunding)} ETH`);
    console.log(`   Have: ${ethers.formatEther(balance)} ETH`);

  // Deploy contract
  console.log("Deploying LSLMSRMarket contract...");
  const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
  
  const market = await LSLMSRMarket.deploy(NUM_OUTCOMES, B0, ALPHA, {
    value: initialFunding
  });

  console.log("Waiting for deployment...");
  await market.waitForDeployment();
  const marketAddress = await market.getAddress();

  console.log("");
  console.log("✅ LSLMSRMarket deployed to:", marketAddress);
  console.log("");

  // Get market info
  console.log("📊 Market Information:");
  const marketInfo = await market.getMarketInfo();
  console.log(`  Outcomes: ${marketInfo[0]}`);
  console.log(`  Base b0: ${ethers.formatEther(marketInfo[1])}`);
  console.log(`  Alpha (α): ${ethers.formatEther(marketInfo[2])}`);
  console.log(`  Current b: ${ethers.formatEther(marketInfo[3])}`);
  console.log(`  Total Volume (Q): ${ethers.formatEther(marketInfo[4])}`);
  console.log(`  Collateral: ${ethers.formatEther(marketInfo[5])} ETH`);
  console.log(`  Resolved: ${marketInfo[6]}`);
  console.log("");

  // Get all quantities
  console.log("📈 Initial Quantities:");
  for (let i = 0; i < NUM_OUTCOMES; i++) {
    const qty = await market.quantities(i);
    console.log(`  Outcome ${i + 1}: ${ethers.formatEther(qty)} shares`);
  }
  console.log("");

  // Get initial prices
  const prices = await market.getPrices();
  console.log("💰 Initial Prices:");
  let priceSum = 0;
  for (let i = 0; i < prices.length; i++) {
    const price = Number(ethers.formatEther(prices[i]));
    priceSum += price;
    console.log(`  Outcome ${i + 1}: ${price.toFixed(6)} (${(price * 100).toFixed(2)}%)`);
  }
  console.log(`  Price sum: ${priceSum.toFixed(6)} (should be ~1.0)`);
  console.log("");

  // Example: Calculate cost to buy 10 shares of outcome 0
  console.log("📈 Example Trade Calculation:");
  const sharesToBuy = ethers.parseEther("10");
  const tradeResult = await market.getTradeCost(0, sharesToBuy);
  const buyCost = tradeResult[0];
  const newPrices = tradeResult[1];
  
  console.log(`  Buying ${ethers.formatEther(sharesToBuy)} shares of Outcome 1:`);
  console.log(`    Cost: ${ethers.formatEther(buyCost)} ETH`);
  console.log(`    Average price per share: $${(Number(ethers.formatEther(buyCost)) / 10).toFixed(6)}`);
  console.log(`    Price impact: ${(((Number(ethers.formatEther(newPrices[0])) - Number(ethers.formatEther(prices[0]))) / Number(ethers.formatEther(prices[0]))) * 100).toFixed(2)}%`);
  console.log("");
  
  console.log("  New prices after this trade would be:");
  for (let i = 0; i < newPrices.length; i++) {
    const newPrice = Number(ethers.formatEther(newPrices[i]));
    const oldPrice = Number(ethers.formatEther(prices[i]));
    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    console.log(`    Outcome ${i + 1}: ${newPrice.toFixed(6)} (${change >= 0 ? '+' : ''}${change.toFixed(2)}%)`);
  }
  console.log("");

  // Calculate cost for selling (if you owned shares)
  console.log("💵 Example Sell Calculation:");
  const sharesToSell = ethers.parseEther("5");
  const sellDelta = -BigInt(sharesToSell);
  
  console.log(`  If you owned shares and sold ${ethers.formatEther(sharesToSell)} shares of Outcome 1:`);
  console.log(`    (This is hypothetical - you need to own shares first)`);
  console.log("");

  // Save deployment info to file
  const fs = require('fs');
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: marketAddress,
    deployer: deployer.address,
    blockNumber: await ethers.provider.getBlockNumber(),
    timestamp: new Date().toISOString(),
    parameters: {
      numOutcomes: NUM_OUTCOMES,
      b0: ethers.formatEther(B0),
      alpha: ethers.formatEther(ALPHA),
      initialFunding: ethers.formatEther(initialFunding)
    },
    initialState: {
      prices: prices.map(p => ethers.formatEther(p)),
      totalVolume: ethers.formatEther(marketInfo[4]),
      collateral: ethers.formatEther(marketInfo[5])
    }
  };

  const deploymentsDir = './deployments';
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir);
  }

  const filename = `${deploymentsDir}/${hre.network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("📝 Deployment Summary:");
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("");
  console.log(`💾 Deployment info saved to: ${filename}`);
  console.log("");

  // Verification instructions
  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("🔍 Verify Contract on Block Explorer:");
    console.log(`npx hardhat verify --network ${hre.network.name} \\`);
    console.log(`  ${marketAddress} \\`);
    console.log(`  ${NUM_OUTCOMES} \\`);
    console.log(`  "${B0.toString()}" \\`);
    console.log(`  "${ALPHA.toString()}"`);
    console.log("");
  }

  console.log("✨ Deployment complete!");
  console.log("");
  console.log("📌 IMPORTANT - Next Steps:");
  console.log("");
  console.log("1. 🔗 Update Frontend Configuration:");
  console.log("   Edit frontend/src/App.jsx and update:");
  console.log(`   const CONTRACT_ADDRESS = "${marketAddress}";`);
  console.log("");
  console.log("2. 🧪 Test the Contract:");
  console.log(`   npx hardhat run scripts/interact.js --network ${hre.network.name}`);
  console.log("   (Don't forget to update CONTRACT_ADDRESS in interact.js too!)");
  console.log("");
  console.log("3. 🎨 Start the Frontend:");
  console.log("   cd frontend");
  console.log("   npm run dev");
  console.log("   Open http://localhost:5173");
  console.log("");
  console.log("4. 📊 View on Block Explorer:");
  if (hre.network.name === "sepolia") {
    console.log(`   https://sepolia.etherscan.io/address/${marketAddress}`);
  } else if (hre.network.name === "baseSepolia") {
    console.log(`   https://sepolia.basescan.org/address/${marketAddress}`);
  }
  console.log("");
  console.log("5. ✅ Test Trading:");
  console.log("   - Connect your wallet in the frontend");
  console.log("   - Try buying shares of different outcomes");
  console.log("   - Observe how prices change with volume");
  console.log("   - Watch the liquidity parameter (b) increase");
  console.log("");
  console.log("💡 Pro Tips:");
  console.log("   - The formula b = b0 × exp(α × Q) means b grows exponentially with volume");
  console.log("   - Higher b = more liquidity = flatter price curves");
  console.log("   - Prices always sum to 1 (representing probabilities)");
  console.log("   - Each trade increases total volume Q by |delta|");
  console.log("");

  return {
    address: marketAddress,
    deployer: deployer.address,
    network: hre.network.name,
    initialFunding: ethers.formatEther(initialFunding)
  };
}

// Execute deployment with error handling
main()
  .then((result) => {
    console.log("🎉 Deployment succeeded!");
    console.log("");
    console.log("Contract Address:", result.address);
    console.log("Network:", result.network);
    console.log("");
    process.exit(0);
  })
  .catch((error) => {
    console.error("");
    console.error("❌ Deployment failed!");
    console.error("");
    console.error("Error:", error.message);
    console.error("");
    
    if (error.message.includes("insufficient funds")) {
      console.error("💡 Solution: Get more testnet ETH from a faucet");
      console.error("   Sepolia: https://sepoliafaucet.com/");
    } else if (error.message.includes("nonce")) {
      console.error("💡 Solution: Reset your MetaMask account or wait a moment");
    } else if (error.message.includes("network")) {
      console.error("💡 Solution: Check your RPC URL in .env file");
    }
    
    console.error("");
    process.exit(1);
  });