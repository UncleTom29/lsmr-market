const hre = require("hardhat");
const { ethers } = require("hardhat");

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0x631bd842064962E084cDc6Db0D47679e4C19982C";

async function main() {
  console.log("🔗 Connecting to LS-LMSR Market Contract...\n");

  // Get contract instance
  const market = await ethers.getContractAt("LSLMSRMarket", CONTRACT_ADDRESS);
  const [signer] = await ethers.getSigners();

  console.log(`Using account: ${signer.address}`);
  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH\n`);

  // Get market information
  console.log("📊 Market Information:");
  const marketInfo = await market.getMarketInfo();
  console.log(`  Number of Outcomes: ${marketInfo[0]}`);
  console.log(`  Base Liquidity (b0): ${ethers.formatEther(marketInfo[1])}`);
  console.log(`  Alpha (α): ${ethers.formatEther(marketInfo[2])}`);
  console.log(`  Current b: ${ethers.formatEther(marketInfo[3])}`);
  console.log(`  Total Volume (Q): ${ethers.formatEther(marketInfo[4])}`);
  console.log(`  Collateral: ${ethers.formatEther(marketInfo[5])} ETH`);
  console.log(`  Market Resolved: ${marketInfo[6]}`);
  if (marketInfo[6]) {
    console.log(`  Winning Outcome: ${marketInfo[7]}`);
  }
  console.log("");

  const numOutcomes = Number(marketInfo[0]);

  // Get current quantities
  console.log("📈 Current Quantities:");
  for (let i = 0; i < numOutcomes; i++) {
    const qty = await market.quantities(i);
    console.log(`  Outcome ${i + 1}: ${ethers.formatEther(qty)} shares`);
  }
  console.log("");

  // Get current prices
  console.log("💰 Current Prices:");
  const prices = await market.getPrices();
  let totalPrice = 0;
  prices.forEach((price, idx) => {
    const priceValue = Number(ethers.formatEther(price));
    totalPrice += priceValue;
    console.log(`  Outcome ${idx + 1}: ${priceValue.toFixed(6)} (${(priceValue * 100).toFixed(2)}%)`);
  });
  console.log(`  Sum of prices: ${totalPrice.toFixed(6)} (should be ~1.0)`);
  console.log("");

  // Example 1: Calculate cost to buy shares
  console.log("🔍 Example 1: Calculate Buy Cost");
  const sharesToBuy = ethers.parseEther("10");
  const outcomeToBuy = 0;
  
  console.log(`  Buying ${ethers.formatEther(sharesToBuy)} shares of Outcome ${outcomeToBuy + 1}`);
  const buyResult = await market.getTradeCost(outcomeToBuy, sharesToBuy);
  const buyCost = buyResult[0];
  const newPricesAfterBuy = buyResult[1];
  
  console.log(`  Cost: ${ethers.formatEther(buyCost)} ETH`);
  console.log(`  Average price per share: ${(Number(ethers.formatEther(buyCost)) / 10).toFixed(6)}`);
  console.log(`  New prices after trade:`);
  newPricesAfterBuy.forEach((price, idx) => {
    const priceValue = Number(ethers.formatEther(price));
    console.log(`    Outcome ${idx + 1}: ${priceValue.toFixed(6)} (${(priceValue * 100).toFixed(2)}%)`);
  });
  console.log("");

  // Example 2: Buy shares (uncomment to execute)
  /*
  console.log("💸 Example 2: Buying Shares");
  console.log(`  Sending transaction to buy ${ethers.formatEther(sharesToBuy)} shares...`);
  
  const buyTx = await market.trade(outcomeToBuy, sharesToBuy, { 
    value: buyCost,
    gasLimit: 500000 
  });
  
  console.log(`  Transaction hash: ${buyTx.hash}`);
  console.log(`  Waiting for confirmation...`);
  
  const buyReceipt = await buyTx.wait();
  console.log(`  ✅ Transaction confirmed in block ${buyReceipt.blockNumber}`);
  console.log(`  Gas used: ${buyReceipt.gasUsed.toString()}`);
  console.log("");

  // Check updated user shares
  const userShares = await market.getUserBalance(signer.address, outcomeToBuy);
  console.log(`  Your shares in Outcome ${outcomeToBuy + 1}: ${ethers.formatEther(userShares)}`);
  console.log("");

  // Check updated prices
  const updatedPrices = await market.getPrices();
  console.log("  Updated Prices:");
  updatedPrices.forEach((price, idx) => {
    const priceValue = Number(ethers.formatEther(price));
    console.log(`    Outcome ${idx + 1}: ${priceValue.toFixed(6)} (${(priceValue * 100).toFixed(2)}%)`);
  });
  console.log("");

  // Check updated market info
  const updatedInfo = await market.getMarketInfo();
  console.log(`  Updated Total Volume: ${ethers.formatEther(updatedInfo[4])}`);
  console.log(`  Updated Current b: ${ethers.formatEther(updatedInfo[3])}`);
  console.log(`  Updated Collateral: ${ethers.formatEther(updatedInfo[5])} ETH`);
  console.log("");
  */

  // Example 3: Check user's holdings
  console.log("👤 Example 3: Check User Holdings");
  const allUserBalances = await market.getAllUserBalances(signer.address);
  console.log(`  Holdings for ${signer.address}:`);
  let hasShares = false;
  for (let i = 0; i < allUserBalances.length; i++) {
    if (allUserBalances[i] > 0) {
      hasShares = true;
      const value = Number(ethers.formatEther(allUserBalances[i])) * Number(ethers.formatEther(prices[i]));
      console.log(`    Outcome ${i + 1}: ${ethers.formatEther(allUserBalances[i])} shares (~${value.toFixed(6)})`);
    }
  }
  if (!hasShares) {
    console.log(`    No shares held yet`);
  }
  console.log("");

  // Example 4: Calculate sell payout (if user has shares)
  if (allUserBalances[0] > 0) {
    console.log("💵 Example 4: Calculate Sell Payout");
    const sharesToSell = allUserBalances[0] > ethers.parseEther("5") 
      ? ethers.parseEther("5") 
      : allUserBalances[0];
    
    console.log(`  Selling ${ethers.formatEther(sharesToSell)} shares of Outcome 1`);
    const sellResult = await market.getTradeCost(0, -BigInt(sharesToSell));
    const sellPayout = -sellResult[0]; // Negate because cost is negative for sells
    
    console.log(`  Payout: ${ethers.formatEther(sellPayout)} ETH`);
    console.log(`  Average price per share: ${(Number(ethers.formatEther(sellPayout)) / Number(ethers.formatEther(sharesToSell))).toFixed(6)}`);
    console.log("");
  }

  // Example 5: Sell shares (uncomment to execute)
  /*
  if (allUserBalances[0] > ethers.parseEther("5")) {
    console.log("💰 Example 5: Selling Shares");
    const sharesToSell = ethers.parseEther("5");
    
    console.log(`  Sending transaction to sell ${ethers.formatEther(sharesToSell)} shares...`);
    
    const sellTx = await market.trade(0, -BigInt(sharesToSell), {
      gasLimit: 500000
    });
    
    console.log(`  Transaction hash: ${sellTx.hash}`);
    console.log(`  Waiting for confirmation...`);
    
    const sellReceipt = await sellTx.wait();
    console.log(`  ✅ Transaction confirmed in block ${sellReceipt.blockNumber}`);
    console.log(`  Gas used: ${sellReceipt.gasUsed.toString()}`);
    console.log("");
  }
  */

  // Example 6: Liquidity sensitivity demonstration
  console.log("📊 Example 6: Liquidity Sensitivity (b = b0 × exp(α × Q))");
  const b0 = Number(ethers.formatEther(marketInfo[1]));
  const alpha = Number(ethers.formatEther(marketInfo[2]));
  const Q = Number(ethers.formatEther(marketInfo[4]));
  const currentB = Number(ethers.formatEther(marketInfo[3]));
  
  console.log(`  b0 (base): ${b0.toFixed(2)}`);
  console.log(`  α (alpha): ${alpha.toFixed(6)}`);
  console.log(`  Q (volume): ${Q.toFixed(2)}`);
  console.log(`  Current b: ${currentB.toFixed(2)}`);
  
  const expectedB = b0 * Math.exp(alpha * Q);
  console.log(`  Expected b (formula): ${expectedB.toFixed(2)}`);
  console.log(`  Match: ${Math.abs(currentB - expectedB) < 0.01 ? '✅' : '❌'}`);
  console.log("");

  // Example 7: Price impact analysis
  console.log("📉 Example 7: Price Impact Analysis");
  const testSizes = [1, 5, 10, 20, 50, 100];
  
  console.log(`  Price impact for buying Outcome 1:`);
  const currentPrice0 = Number(ethers.formatEther(prices[0]));
  
  for (const size of testSizes) {
    const shares = ethers.parseEther(size.toString());
    const result = await market.getTradeCost(0, shares);
    const cost = result[0];
    const avgPrice = Number(ethers.formatEther(cost)) / size;
    const priceImpact = ((avgPrice - currentPrice0) / currentPrice0) * 100;
    
    console.log(`    ${size} shares: ${avgPrice.toFixed(6)} per share (${priceImpact >= 0 ? '+' : ''}${priceImpact.toFixed(2)}% impact)`);
  }
  console.log("");

  // Example 8: Simulate market making scenario
  console.log("🎲 Example 8: Market Making Simulation");
  console.log("  What if someone buys 50 shares of Outcome 1?");
  
  const largeTrade = ethers.parseEther("50");
  const largeTradeResult = await market.getTradeCost(0, largeTrade);
  const largeCost = largeTradeResult[0];
  const pricesAfterLarge = largeTradeResult[1];
  
  console.log(`    Trade cost: ${ethers.formatEther(largeCost)} ETH`);
  console.log(`    Average price: ${(Number(ethers.formatEther(largeCost)) / 50).toFixed(6)}`);
  console.log(`    New market prices:`);
  pricesAfterLarge.forEach((price, idx) => {
    const priceValue = Number(ethers.formatEther(price));
    const priceDiff = priceValue - Number(ethers.formatEther(prices[idx]));
    console.log(`      Outcome ${idx + 1}: ${priceValue.toFixed(6)} (${priceDiff >= 0 ? '+' : ''}${(priceDiff * 100).toFixed(2)}%)`);
  });
  console.log("");

  // Example 9: Check if market is resolved
  console.log("🏆 Example 9: Market Resolution Status");
  if (marketInfo[6]) {
    console.log(`  ✅ Market is RESOLVED`);
    console.log(`  Winning outcome: Outcome ${Number(marketInfo[7]) + 1}`);
    
    const userWinningShares = await market.getUserBalance(signer.address, marketInfo[7]);
    if (userWinningShares > 0) {
      console.log(`  You have ${ethers.formatEther(userWinningShares)} winning shares!`);
      console.log(`  Potential payout: ${ethers.formatEther(userWinningShares)} ETH`);
      console.log(`  Call claimWinnings() to receive your payout`);
    } else {
      console.log(`  You don't have shares in the winning outcome`);
    }
  } else {
    console.log(`  ⏳ Market is NOT yet resolved`);
    console.log(`  Only the owner can resolve the market by calling resolveMarket(winningOutcome)`);
  }
  console.log("");

  // Example 10: Mathematical verification
  console.log("🔬 Example 10: LS-LMSR Formula Verification");
  console.log("  Verifying: b = b0 × exp(α × Q)");
  console.log(`  Left side (contract):  b = ${currentB.toFixed(6)}`);
  console.log(`  Right side (formula):  b0 × exp(α × Q) = ${b0.toFixed(2)} × exp(${alpha.toFixed(6)} × ${Q.toFixed(2)})`);
  console.log(`                        = ${b0.toFixed(2)} × ${Math.exp(alpha * Q).toFixed(6)}`);
  console.log(`                        = ${expectedB.toFixed(6)}`);
  console.log(`  Verification: ${Math.abs(currentB - expectedB) < 1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log("");

  // Summary
  console.log("📋 Summary");
  console.log("Available functions:");
  console.log("  Trading:");
  console.log("    - trade(outcome, delta) [delta positive = buy, negative = sell]");
  console.log("    - getTradeCost(outcome, delta) [view function]");
  console.log("");
  console.log("  Market Management:");
  console.log("    - resolveMarket(winningOutcome) [owner only]");
  console.log("    - claimWinnings() [after resolution]");
  console.log("");
  console.log("  View Functions:");
  console.log("    - getPrices()");
  console.log("    - getB()");
  console.log("    - getUserBalance(address, outcome)");
  console.log("    - getAllUserBalances(address)");
  console.log("    - getMarketInfo()");
  console.log("");
  
  console.log("✨ Interaction examples completed!");
  console.log("");
  console.log("💡 Tips:");
  console.log("  - To execute trades, uncomment the transaction code blocks above");
  console.log("  - Remember to have enough ETH for gas fees");
  console.log("  - Use positive delta for buying, negative for selling");
  console.log("  - Monitor how b increases with trading volume (Q)");
  console.log("");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });