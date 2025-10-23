const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LSLMSRMarket", function () {
  let market;
  let owner;
  let user1;
  let user2;
  
  const NUM_OUTCOMES = 2;
  const B0 = ethers.parseEther("100");
  const ALPHA = ethers.parseEther("0.01"); // 0.01 sensitivity
  
  // Calculate initial funding: b0 * ln(n)
  const lnN = Math.log(NUM_OUTCOMES);
  const INITIAL_FUNDING = ethers.parseEther((100 * lnN).toFixed(18));

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
    market = await LSLMSRMarket.deploy(NUM_OUTCOMES, B0, ALPHA, {
      value: INITIAL_FUNDING
    });
    await market.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const marketInfo = await market.getMarketInfo();
      
      expect(marketInfo[0]).to.equal(NUM_OUTCOMES);
      expect(marketInfo[1]).to.equal(B0);
      expect(marketInfo[2]).to.equal(ALPHA);
      expect(marketInfo[5]).to.be.closeTo(INITIAL_FUNDING, ethers.parseEther("0.01"));
      expect(marketInfo[6]).to.equal(false); // Not resolved
    });

    it("Should initialize with zero quantities", async function () {
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        const qty = await market.quantities(i);
        expect(qty).to.equal(0);
      }
    });

    it("Should reject invalid number of outcomes", async function () {
      const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
      
      await expect(
        LSLMSRMarket.deploy(1, B0, ALPHA, { value: INITIAL_FUNDING })
      ).to.be.revertedWithCustomError(market, "InvalidNumOutcomes");
      
      await expect(
        LSLMSRMarket.deploy(6, B0, ALPHA, { value: INITIAL_FUNDING })
      ).to.be.revertedWithCustomError(market, "InvalidNumOutcomes");
    });

    it("Should reject invalid initial funding", async function () {
      const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
      
      await expect(
        LSLMSRMarket.deploy(2, B0, ALPHA, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(market, "InvalidInitialFunding");
    });
  });

  describe("Liquidity Parameter (b)", function () {
    it("Should start with b = b0 when volume is 0", async function () {
      const currentB = await market.getB();
      expect(currentB).to.be.closeTo(B0, ethers.parseEther("0.1"));
    });

    it("Should increase b with trading volume", async function () {
      const bBefore = await market.getB();
      
      // Execute a trade
      const shares = ethers.parseEther("10");
      const result = await market.getTradeCost(0, shares);
      await market.connect(user1).trade(0, shares, { value: result[0] });
      
      const bAfter = await market.getB();
      expect(bAfter).to.be.greaterThan(bBefore);
    });
  });

  describe("Price Calculation", function () {
    it("Should start with equal prices for all outcomes", async function () {
      const prices = await market.getPrices();
      const expectedPrice = ethers.parseEther("1") / BigInt(NUM_OUTCOMES);
      
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        expect(prices[i]).to.be.closeTo(expectedPrice, ethers.parseEther("0.01"));
      }
    });

    it("Should have prices that sum to 1", async function () {
      const prices = await market.getPrices();
      let sum = BigInt(0);
      
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        sum += prices[i];
      }
      
      expect(sum).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
    });

    it("Should update prices after buying shares", async function () {
      const sharesToBuy = ethers.parseEther("10");
      const result = await market.getTradeCost(0, sharesToBuy);
      
      await market.connect(user1).trade(0, sharesToBuy, { value: result[0] });
      
      const prices = await market.getPrices();
      expect(prices[0]).to.be.greaterThan(ethers.parseEther("0.5"));
      
      // Prices should still sum to 1
      let sum = BigInt(0);
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        sum += prices[i];
      }
      expect(sum).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
    });
  });

  describe("Trading - Buying Shares", function () {
    it("Should allow buying shares with correct payment", async function () {
      const sharesToBuy = ethers.parseEther("5");
      const result = await market.getTradeCost(0, sharesToBuy);
      const cost = result[0];
      
      await expect(
        market.connect(user1).trade(0, sharesToBuy, { value: cost })
      ).to.emit(market, "SharesTransferred")
        .withArgs(user1.address, 0, sharesToBuy);
      
      const userBalance = await market.getUserBalance(user1.address, 0);
      expect(userBalance).to.equal(sharesToBuy);
    });

    it("Should reject insufficient payment", async function () {
      const sharesToBuy = ethers.parseEther("5");
      const result = await market.getTradeCost(0, sharesToBuy);
      const cost = result[0];
      const insufficientPayment = cost - ethers.parseEther("0.1");
      
      await expect(
        market.connect(user1).trade(0, sharesToBuy, { value: insufficientPayment })
      ).to.be.revertedWithCustomError(market, "InsufficientPayment");
    });

    it("Should refund excess payment", async function () {
      const sharesToBuy = ethers.parseEther("5");
      const result = await market.getTradeCost(0, sharesToBuy);
      const cost = result[0];
      const excessPayment = cost + ethers.parseEther("1");
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await market.connect(user1).trade(0, sharesToBuy, { value: excessPayment });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const actualDecrease = balanceBefore - balanceAfter;
      const expectedDecrease = cost + gasUsed;
      
      expect(actualDecrease).to.be.closeTo(expectedDecrease, ethers.parseEther("0.01"));
    });

    it("Should increase quantities correctly", async function () {
      const sharesToBuy = ethers.parseEther("10");
      const result = await market.getTradeCost(0, sharesToBuy);
      
      await market.connect(user1).trade(0, sharesToBuy, { value: result[0] });
      
      const qty = await market.quantities(0);
      expect(qty).to.equal(sharesToBuy);
    });

    it("Should increase collateral", async function () {
      const infooBefore = await market.getMarketInfo();
      const collateralBefore = infoBefore[5];
      
      const sharesToBuy = ethers.parseEther("10");
      const result = await market.getTradeCost(0, sharesToBuy);
      
      await market.connect(user1).trade(0, sharesToBuy, { value: result[0] });
      
      const infoAfter = await market.getMarketInfo();
      const collateralAfter = infoAfter[5];
      
      expect(collateralAfter).to.be.greaterThan(collateralBefore);
    });
  });

  describe("Trading - Selling Shares", function () {
    beforeEach(async function () {
      // Buy shares first
      const sharesToBuy = ethers.parseEther("20");
      const result = await market.getTradeCost(0, sharesToBuy);
      await market.connect(user1).trade(0, sharesToBuy, { value: result[0] });
    });

    it("Should allow selling shares", async function () {
      const sharesToSell = ethers.parseEther("10");
      const delta = -BigInt(sharesToSell);
      
      await expect(
        market.connect(user1).trade(0, delta)
      ).to.emit(market, "SharesTransferred")
        .withArgs(user1.address, 0, delta);
      
      const userBalance = await market.getUserBalance(user1.address, 0);
      expect(userBalance).to.equal(ethers.parseEther("10"));
    });

    it("Should reject selling more shares than owned", async function () {
      const sharesToSell = ethers.parseEther("100");
      const delta = -BigInt(sharesToSell);
      
      await expect(
        market.connect(user1).trade(0, delta)
      ).to.be.revertedWithCustomError(market, "InsufficientShares");
    });

    it("Should transfer payout correctly", async function () {
      const sharesToSell = ethers.parseEther("10");
      const delta = -BigInt(sharesToSell);
      const result = await market.getTradeCost(0, delta);
      const payout = -result[0]; // Negate because cost is negative
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await market.connect(user1).trade(0, delta);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const actualIncrease = balanceAfter - balanceBefore + gasUsed;
      
      expect(actualIncrease).to.be.closeTo(payout, ethers.parseEther("0.01"));
    });
  });

  describe("Market Resolution", function () {
    beforeEach(async function () {
      // Set up market with trades
      const result0 = await market.getTradeCost(0, ethers.parseEther("10"));
      await market.connect(user1).trade(0, ethers.parseEther("10"), { value: result0[0] });
      
      const result1 = await market.getTradeCost(1, ethers.parseEther("5"));
      await market.connect(user2).trade(1, ethers.parseEther("5"), { value: result1[0] });
    });

    it("Should allow owner to resolve market", async function () {
      const winningOutcome = 0;
      
      await expect(market.resolveMarket(winningOutcome))
        .to.emit(market, "MarketResolved")
        .withArgs(winningOutcome);
      
      const marketInfo = await market.getMarketInfo();
      expect(marketInfo[6]).to.equal(true); // Resolved
      expect(marketInfo[7]).to.equal(winningOutcome);
    });

    it("Should reject resolution from non-owner", async function () {
      await expect(
        market.connect(user1).resolveMarket(0)
      ).to.be.revertedWithCustomError(market, "OnlyOwner");
    });

    it("Should prevent trading after resolution", async function () {
      await market.resolveMarket(0);
      
      const result = await market.getTradeCost(0, ethers.parseEther("5"));
      
      await expect(
        market.connect(user1).trade(0, ethers.parseEther("5"), { value: result[0] })
      ).to.be.revertedWithCustomError(market, "MarketAlreadyResolved");
    });

    it("Should allow claiming winnings", async function () {
      await market.resolveMarket(0);
      
      const userShares = await market.getUserBalance(user1.address, 0);
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await market.connect(user1).claimWinnings();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      const actualPayout = balanceAfter - balanceBefore + gasUsed;
      
      expect(actualPayout).to.be.closeTo(userShares, ethers.parseEther("0.01"));
    });
  });

  describe("Volume Tracking", function () {
    it("Should track cumulative volume correctly", async function () {
      const infoBefore = await market.getMarketInfo();
      expect(infoBefore[4]).to.equal(0); // totalVolume starts at 0
      
      // Buy 10 shares
      const shares1 = ethers.parseEther("10");
      const result1 = await market.getTradeCost(0, shares1);
      await market.connect(user1).trade(0, shares1, { value: result1[0] });
      
      let infoAfter = await market.getMarketInfo();
      expect(infoAfter[4]).to.equal(shares1);
      
      // Sell 5 shares (volume should increase by 5, not decrease)
      const shares2 = ethers.parseEther("5");
      const delta = -BigInt(shares2);
      await market.connect(user1).trade(0, delta);
      
      infoAfter = await market.getMarketInfo();
      expect(infoAfter[4]).to.equal(shares1 + shares2); // 10 + 5 = 15
    });

    it("Should increase b as volume increases", async function () {
      const b0Value = await market.getB();
      
      // Execute multiple trades to increase volume
      for (let i = 0; i < 3; i++) {
        const outcome = i % NUM_OUTCOMES;
        const shares = ethers.parseEther("10");
        const result = await market.getTradeCost(outcome, shares);
        await market.connect(user1).trade(outcome, shares, { value: result[0] });
      }
      
      const bAfter = await market.getB();
      expect(bAfter).to.be.greaterThan(b0Value);
    });
  });

  describe("Multi-outcome Market", function () {
    let multiMarket;
    const MULTI_OUTCOMES = 4;
    const multiLnN = Math.log(MULTI_OUTCOMES);
    const MULTI_FUNDING = ethers.parseEther((100 * multiLnN).toFixed(18));

    beforeEach(async function () {
      const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
      multiMarket = await LSLMSRMarket.deploy(MULTI_OUTCOMES, B0, ALPHA, {
        value: MULTI_FUNDING
      });
      await multiMarket.waitForDeployment();
    });

    it("Should initialize with 4 outcomes", async function () {
      const marketInfo = await multiMarket.getMarketInfo();
      expect(marketInfo[0]).to.equal(MULTI_OUTCOMES);
    });

    it("Should have equal initial prices", async function () {
      const prices = await multiMarket.getPrices();
      const expectedPrice = ethers.parseEther("1") / BigInt(MULTI_OUTCOMES);
      
      for (let i = 0; i < MULTI_OUTCOMES; i++) {
        expect(prices[i]).to.be.closeTo(expectedPrice, ethers.parseEther("0.01"));
      }
    });

    it("Should maintain price invariant with multiple outcomes", async function () {
      // Buy shares in different outcomes
      for (let i = 0; i < 3; i++) {
        const shares = ethers.parseEther(String((i + 1) * 5));
        const result = await multiMarket.getTradeCost(i, shares);
        await multiMarket.connect(user1).trade(i, shares, { value: result[0] });
      }
      
      const prices = await multiMarket.getPrices();
      let sum = BigInt(0);
      
      for (let i = 0; i < MULTI_OUTCOMES; i++) {
        sum += prices[i];
      }
      
      expect(sum).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
    });
  });

  describe("Cost Function", function () {
    it("Should calculate correct trade costs", async function () {
      const shares = ethers.parseEther("10");
      const result = await market.getTradeCost(0, shares);
      const cost = result[0];
      
      // Cost should be positive for buying
      expect(cost).to.be.greaterThan(0);
      
      // Cost should be reasonable (between 0 and shares)
      expect(cost).to.be.lessThan(shares);
    });

    it("Should show negative cost (payout) for selling", async function () {
      // First buy shares
      const buyShares = ethers.parseEther("20");
      const buyResult = await market.getTradeCost(0, buyShares);
      await market.connect(user1).trade(0, buyShares, { value: buyResult[0] });
      
      // Then calculate sell cost
      const sellShares = ethers.parseEther("10");
      const delta = -BigInt(sellShares);
      const sellResult = await market.getTradeCost(0, delta);
      const cost = sellResult[0];
      
      // Cost should be negative for selling (represents payout)
      expect(cost).to.be.lessThan(0);
    });
  });

  describe("Gas Optimization", function () {
    it("Should have reasonable gas costs for buying", async function () {
      const sharesToBuy = ethers.parseEther("10");
      const result = await market.getTradeCost(0, sharesToBuy);
      
      const tx = await market.connect(user1).trade(0, sharesToBuy, { value: result[0] });
      const receipt = await tx.wait();
      
      console.log(`      Gas used for buying shares: ${receipt.gasUsed.toString()}`);
      
      // Should be reasonable (depends on complexity)
      expect(receipt.gasUsed).to.be.lessThan(600000);
    });

    it("Should have reasonable gas costs for selling", async function () {
      // First buy shares
      const sharesToBuy = ethers.parseEther("20");
      const buyResult = await market.getTradeCost(0, sharesToBuy);
      await market.connect(user1).trade(0, sharesToBuy, { value: buyResult[0] });
      
      // Then sell
      const sharesToSell = ethers.parseEther("10");
      const delta = -BigInt(sharesToSell);
      const tx = await market.connect(user1).trade(0, delta);
      const receipt = await tx.wait();
      
      console.log(`      Gas used for selling shares: ${receipt.gasUsed.toString()}`);
      
      expect(receipt.gasUsed).to.be.lessThan(500000);
    });
  });

  describe("Edge Cases", function () {
    it("Should reject zero delta trades", async function () {
      await expect(
        market.connect(user1).trade(0, 0, { value: 0 })
      ).to.be.revertedWithCustomError(market, "InvalidDelta");
    });

    it("Should reject invalid outcome", async function () {
      const shares = ethers.parseEther("10");
      
      await expect(
        market.getTradeCost(NUM_OUTCOMES, shares)
      ).to.be.revertedWithCustomError(market, "InvalidOutcome");
    });

    it("Should handle very small trades", async function () {
      const tinyShares = ethers.parseEther("0.001");
      const result = await market.getTradeCost(0, tinyShares);
      
      await expect(
        market.connect(user1).trade(0, tinyShares, { value: result[0] })
      ).to.not.be.reverted;
    });

    it("Should handle large trades", async function () {
      const largeShares = ethers.parseEther("100");
      const result = await market.getTradeCost(0, largeShares);
      
      await expect(
        market.connect(user1).trade(0, largeShares, { value: result[0] })
      ).to.not.be.reverted;
    });

    it("Should maintain accuracy with repeated trades", async function () {
      // Execute multiple trades
      for (let i = 0; i < 5; i++) {
        const outcome = i % NUM_OUTCOMES;
        const shares = ethers.parseEther(String(i + 1));
        const result = await market.getTradeCost(outcome, shares);
        await market.connect(user1).trade(outcome, shares, { value: result[0] });
      }
      
      // Prices should still sum to 1
      const prices = await market.getPrices();
      let sum = BigInt(0);
      
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        sum += prices[i];
      }
      
      expect(sum).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.01"));
    });
  });

  describe("Mathematical Correctness", function () {
    it("Should implement LS-LMSR formula correctly", async function () {
      // Get initial state
      const infoBefore = await market.getMarketInfo();
      const b0Value = Number(ethers.formatEther(infoBefore[1]));
      const alphaValue = Number(ethers.formatEther(infoBefore[2]));
      
      // Execute trades to create volume
      const shares = ethers.parseEther("10");
      const result = await market.getTradeCost(0, shares);
      await market.connect(user1).trade(0, shares, { value: result[0] });
      
      // Check b = b0 * exp(alpha * Q)
      const infoAfter = await market.getMarketInfo();
      const Q = Number(ethers.formatEther(infoAfter[4]));
      const actualB = Number(ethers.formatEther(infoAfter[3]));
      const expectedB = b0Value * Math.exp(alphaValue * Q);
      
      // Allow for small rounding errors
      const tolerance = expectedB * 0.01; // 1% tolerance
      expect(Math.abs(actualB - expectedB)).to.be.lessThan(tolerance);
    });

    it("Should have prices that reflect share quantities", async function () {
      // Buy different amounts for different outcomes
      const shares0 = ethers.parseEther("20");
      const result0 = await market.getTradeCost(0, shares0);
      await market.connect(user1).trade(0, shares0, { value: result0[0] });
      
      const shares1 = ethers.parseEther("5");
      const result1 = await market.getTradeCost(1, shares1);
      await market.connect(user2).trade(1, shares1, { value: result1[0] });
      
      const prices = await market.getPrices();
      
      // Outcome 0 should have higher price because it has more shares
      expect(prices[0]).to.be.greaterThan(prices[1]);
    });
  });

  describe("User Balance Tracking", function () {
    it("Should track individual user balances", async function () {
      const shares = ethers.parseEther("10");
      const result = await market.getTradeCost(0, shares);
      
      await market.connect(user1).trade(0, shares, { value: result[0] });
      
      const balance = await market.getUserBalance(user1.address, 0);
      expect(balance).to.equal(shares);
      
      // Other outcome should be 0
      const balance1 = await market.getUserBalance(user1.address, 1);
      expect(balance1).to.equal(0);
    });

    it("Should return all user balances", async function () {
      // Buy shares in both outcomes
      const shares0 = ethers.parseEther("10");
      const result0 = await market.getTradeCost(0, shares0);
      await market.connect(user1).trade(0, shares0, { value: result0[0] });
      
      const shares1 = ethers.parseEther("5");
      const result1 = await market.getTradeCost(1, shares1);
      await market.connect(user1).trade(1, shares1, { value: result1[0] });
      
      const balances = await market.getAllUserBalances(user1.address);
      
      expect(balances[0]).to.equal(shares0);
      expect(balances[1]).to.equal(shares1);
    });

    it("Should track balances for multiple users", async function () {
      const shares = ethers.parseEther("10");
      const result = await market.getTradeCost(0, shares);
      
      await market.connect(user1).trade(0, shares, { value: result[0] });
      await market.connect(user2).trade(0, shares, { value: result[0] });
      
      const balance1 = await market.getUserBalance(user1.address, 0);
      const balance2 = await market.getUserBalance(user2.address, 0);
      
      expect(balance1).to.equal(shares);
      expect(balance2).to.equal(shares);
    });
  });
});const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LSLMSRMarket", function () {
  let market;
  let owner;
  let user1;
  let user2;
  
  const NUM_OUTCOMES = 2;
  const B0 = ethers.parseEther("100");
  const ALPHA = 50; // 0.5
  const INITIAL_LIQUIDITY = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
    market = await LSLMSRMarket.deploy(NUM_OUTCOMES, B0, ALPHA);
    await market.waitForDeployment();
    
    // Add initial liquidity
    await market.addLiquidity({ value: INITIAL_LIQUIDITY });
  });

  describe("Deployment", function () {
    it("Should deploy with correct parameters", async function () {
      const marketInfo = await market.getMarketInfo();
      
      expect(marketInfo[0]).to.equal(NUM_OUTCOMES);
      expect(marketInfo[1]).to.equal(B0);
      expect(marketInfo[2]).to.equal(ALPHA);
      expect(marketInfo[4]).to.equal(INITIAL_LIQUIDITY);
      expect(marketInfo[5]).to.equal(false); // Not resolved
    });

    it("Should initialize with zero quantities", async function () {
      const quantities = await market.getAllQuantities();
      
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        expect(quantities[i]).to.equal(0);
      }
    });

    it("Should reject invalid number of outcomes", async function () {
      const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
      
      await expect(
        LSLMSRMarket.deploy(1, B0, ALPHA)
      ).to.be.revertedWith("Invalid number of outcomes");
      
      await expect(
        LSLMSRMarket.deploy(6, B0, ALPHA)
      ).to.be.revertedWith("Invalid number of outcomes");
    });

    it("Should reject invalid alpha", async function () {
      const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
      
      await expect(
        LSLMSRMarket.deploy(2, B0, 101)
      ).to.be.revertedWith("Alpha must be <= 100");
    });
  });

  describe("Liquidity Management", function () {
    it("Should allow adding liquidity", async function () {
      const additionalLiquidity = ethers.parseEther("5");
      
      await expect(market.addLiquidity({ value: additionalLiquidity }))
        .to.emit(market, "LiquidityAdded")
        .withArgs(additionalLiquidity);
      
      const marketInfo = await market.getMarketInfo();
      expect(marketInfo[4]).to.equal(INITIAL_LIQUIDITY + additionalLiquidity);
    });

    it("Should calculate current b with liquidity", async function () {
      const currentB = await market.getCurrentB();
      
      // b = b0 * (1 + alpha * L)
      // With 10 ETH liquidity and alpha = 0.5
      // Expected: 100 * (1 + 0.5 * 10) = 100 * 6 = 600 ETH
      const expectedB = B0 + (B0 * INITIAL_LIQUIDITY * BigInt(ALPHA)) / ethers.parseEther("100");
      
      expect(currentB).to.be.closeTo(expectedB, ethers.parseEther("1"));
    });
  });

  describe("Price Calculation", function () {
    it("Should start with equal prices for all outcomes", async function () {
      const prices = await market.getAllPrices();
      
      const expectedPrice = ethers.parseEther("1") / BigInt(NUM_OUTCOMES);
      
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        expect(prices[i]).to.be.closeTo(expectedPrice, ethers.parseEther("0.01"));
      }
    });

    it("Should have prices that sum to 1", async function () {
      const prices = await market.getAllPrices();
      
      let sum = BigInt(0);
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        sum += prices[i];
      }
      
      expect(sum).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
    });

    it("Should update prices after buying shares", async function () {
      const sharesToBuy = ethers.parseEther("10");
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      
      await market.connect(user1).buyShares(0, sharesToBuy, { value: cost });
      
      const prices = await market.getAllPrices();
      
      // Price of outcome 0 should increase
      expect(prices[0]).to.be.greaterThan(ethers.parseEther("0.5"));
      
      // Prices should still sum to 1
      let sum = BigInt(0);
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        sum += prices[i];
      }
      expect(sum).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
    });
  });

  describe("Buying Shares", function () {
    it("Should allow buying shares with correct payment", async function () {
      const sharesToBuy = ethers.parseEther("5");
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      
      await expect(
        market.connect(user1).buyShares(0, sharesToBuy, { value: cost })
      ).to.emit(market, "SharesPurchased")
        .withArgs(user1.address, 0, sharesToBuy, cost);
      
      const userShares = await market.getUserShares(user1.address, 0);
      expect(userShares).to.equal(sharesToBuy);
    });

    it("Should reject insufficient payment", async function () {
      const sharesToBuy = ethers.parseEther("5");
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      const insufficientPayment = cost - ethers.parseEther("0.1");
      
      await expect(
        market.connect(user1).buyShares(0, sharesToBuy, { value: insufficientPayment })
      ).to.be.revertedWithCustomError(market, "InsufficientPayment");
    });

    it("Should refund excess payment", async function () {
      const sharesToBuy = ethers.parseEther("5");
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      const excessPayment = cost + ethers.parseEther("1");
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await market.connect(user1).buyShares(0, sharesToBuy, { value: excessPayment });
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      
      // Balance should decrease by cost + gas, not by excessPayment + gas
      const expectedDecrease = cost + gasUsed;
      const actualDecrease = balanceBefore - balanceAfter;
      
      expect(actualDecrease).to.be.closeTo(expectedDecrease, ethers.parseEther("0.01"));
    });

    it("Should reject invalid outcome", async function () {
      const sharesToBuy = ethers.parseEther("5");
      
      await expect(
        market.connect(user1).buyShares(NUM_OUTCOMES, sharesToBuy, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(market, "InvalidOutcome");
    });

    it("Should update quantities correctly", async function () {
      const sharesToBuy = ethers.parseEther("10");
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      
      await market.connect(user1).buyShares(0, sharesToBuy, { value: cost });
      
      const quantities = await market.getAllQuantities();
      expect(quantities[0]).to.equal(sharesToBuy);
    });

    it("Should increase price with more purchases", async function () {
      const sharesToBuy = ethers.parseEther("10");
      
      const priceBefore = await market.getPrice(0);
      
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      await market.connect(user1).buyShares(0, sharesToBuy, { value: cost });
      
      const priceAfter = await market.getPrice(0);
      
      expect(priceAfter).to.be.greaterThan(priceBefore);
    });
  });

  describe("Selling Shares", function () {
    beforeEach(async function () {
      // Buy shares first
      const sharesToBuy = ethers.parseEther("20");
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      await market.connect(user1).buyShares(0, sharesToBuy, { value: cost });
    });

    it("Should allow selling shares", async function () {
      const sharesToSell = ethers.parseEther("10");
      const payout = await market.calculateSellPayout(0, sharesToSell);
      
      await expect(
        market.connect(user1).sellShares(0, sharesToSell)
      ).to.emit(market, "SharesSold")
        .withArgs(user1.address, 0, sharesToSell, payout);
      
      const userShares = await market.getUserShares(user1.address, 0);
      expect(userShares).to.equal(ethers.parseEther("10"));
    });

    it("Should reject selling more shares than owned", async function () {
      const sharesToSell = ethers.parseEther("100");
      
      await expect(
        market.connect(user1).sellShares(0, sharesToSell)
      ).to.be.revertedWithCustomError(market, "InsufficientShares");
    });

    it("Should transfer payout correctly", async function () {
      const sharesToSell = ethers.parseEther("10");
      const payout = await market.calculateSellPayout(0, sharesToSell);
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await market.connect(user1).sellShares(0, sharesToSell);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      
      const expectedIncrease = payout - gasUsed;
      const actualIncrease = balanceAfter - balanceBefore;
      
      expect(actualIncrease).to.be.closeTo(expectedIncrease, ethers.parseEther("0.01"));
    });

    it("Should decrease price when selling", async function () {
      const priceBefore = await market.getPrice(0);
      
      const sharesToSell = ethers.parseEther("5");
      await market.connect(user1).sellShares(0, sharesToSell);
      
      const priceAfter = await market.getPrice(0);
      
      expect(priceAfter).to.be.lessThan(priceBefore);
    });
  });

  describe("Market Resolution", function () {
    beforeEach(async function () {
      // Set up market with trades
      const cost0 = await market.calculateBuyCost(0, ethers.parseEther("10"));
      await market.connect(user1).buyShares(0, ethers.parseEther("10"), { value: cost0 });
      
      const cost1 = await market.calculateBuyCost(1, ethers.parseEther("5"));
      await market.connect(user2).buyShares(1, ethers.parseEther("5"), { value: cost1 });
    });

    it("Should allow owner to resolve market", async function () {
      const winningOutcome = 0;
      
      await expect(market.resolveMarket(winningOutcome))
        .to.emit(market, "MarketResolved")
        .withArgs(winningOutcome);
      
      const marketInfo = await market.getMarketInfo();
      expect(marketInfo[5]).to.equal(true); // Resolved
      expect(marketInfo[6]).to.equal(winningOutcome);
    });

    it("Should reject resolution from non-owner", async function () {
      await expect(
        market.connect(user1).resolveMarket(0)
      ).to.be.revertedWithCustomError(market, "OnlyOwner");
    });

    it("Should reject invalid winning outcome", async function () {
      await expect(
        market.resolveMarket(NUM_OUTCOMES)
      ).to.be.revertedWithCustomError(market, "InvalidOutcome");
    });

    it("Should prevent trading after resolution", async function () {
      await market.resolveMarket(0);
      
      const sharesToBuy = ethers.parseEther("5");
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      
      await expect(
        market.connect(user1).buyShares(0, sharesToBuy, { value: cost })
      ).to.be.revertedWithCustomError(market, "MarketAlreadyResolved");
    });

    it("Should allow claiming winnings", async function () {
      await market.resolveMarket(0);
      
      const userShares = await market.getUserShares(user1.address, 0);
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      
      const tx = await market.connect(user1).claimWinnings();
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      
      const balanceAfter = await ethers.provider.getBalance(user1.address);
      
      // User should receive 1 ETH per winning share
      const expectedPayout = userShares;
      const actualPayout = balanceAfter - balanceBefore + gasUsed;
      
      expect(actualPayout).to.be.closeTo(expectedPayout, ethers.parseEther("0.01"));
    });

    it("Should prevent claiming if not resolved", async function () {
      await expect(
        market.connect(user1).claimWinnings()
      ).to.be.revertedWithCustomError(market, "MarketNotResolved");
    });

    it("Should prevent claiming with no shares", async function () {
      await market.resolveMarket(1); // User1 has shares in outcome 0
      
      await expect(
        market.connect(user1).claimWinnings()
      ).to.be.revertedWith("No shares to claim");
    });
  });

  describe("Multi-outcome Market", function () {
    let multiMarket;
    const MULTI_OUTCOMES = 4;

    beforeEach(async function () {
      const LSLMSRMarket = await ethers.getContractFactory("LSLMSRMarket");
      multiMarket = await LSLMSRMarket.deploy(MULTI_OUTCOMES, B0, ALPHA);
      await multiMarket.waitForDeployment();
      await multiMarket.addLiquidity({ value: INITIAL_LIQUIDITY });
    });

    it("Should initialize with 4 outcomes", async function () {
      const marketInfo = await multiMarket.getMarketInfo();
      expect(marketInfo[0]).to.equal(MULTI_OUTCOMES);
    });

    it("Should have equal initial prices", async function () {
      const prices = await multiMarket.getAllPrices();
      const expectedPrice = ethers.parseEther("1") / BigInt(MULTI_OUTCOMES);
      
      for (let i = 0; i < MULTI_OUTCOMES; i++) {
        expect(prices[i]).to.be.closeTo(expectedPrice, ethers.parseEther("0.01"));
      }
    });

    it("Should maintain price invariant with multiple outcomes", async function () {
      // Buy shares in different outcomes
      for (let i = 0; i < 3; i++) {
        const shares = ethers.parseEther(String((i + 1) * 5));
        const cost = await multiMarket.calculateBuyCost(i, shares);
        await multiMarket.connect(user1).buyShares(i, shares, { value: cost });
      }
      
      const prices = await multiMarket.getAllPrices();
      let sum = BigInt(0);
      
      for (let i = 0; i < MULTI_OUTCOMES; i++) {
        sum += prices[i];
      }
      
      expect(sum).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.001"));
    });
  });

  describe("Gas Optimization", function () {
    it("Should have reasonable gas costs for buying", async function () {
      const sharesToBuy = ethers.parseEther("10");
      const cost = await market.calculateBuyCost(0, sharesToBuy);
      
      const tx = await market.connect(user1).buyShares(0, sharesToBuy, { value: cost });
      const receipt = await tx.wait();
      
      console.log(`      Gas used for buying shares: ${receipt.gasUsed.toString()}`);
      
      // Should be less than 200k gas
      expect(receipt.gasUsed).to.be.lessThan(200000);
    });

    it("Should have reasonable gas costs for selling", async function () {
      // First buy shares
      const sharesToBuy = ethers.parseEther("20");
      const buyCost = await market.calculateBuyCost(0, sharesToBuy);
      await market.connect(user1).buyShares(0, sharesToBuy, { value: buyCost });
      
      // Then sell
      const sharesToSell = ethers.parseEther("10");
      const tx = await market.connect(user1).sellShares(0, sharesToSell);
      const receipt = await tx.wait();
      
      console.log(`      Gas used for selling shares: ${receipt.gasUsed.toString()}`);
      
      // Should be less than 150k gas
      expect(receipt.gasUsed).to.be.lessThan(150000);
    });
  });

  describe("Edge Cases", function () {
    it("Should handle very small trades", async function () {
      const tinyShares = ethers.parseEther("0.001");
      const cost = await market.calculateBuyCost(0, tinyShares);
      
      await expect(
        market.connect(user1).buyShares(0, tinyShares, { value: cost })
      ).to.not.be.reverted;
    });

    it("Should handle large trades", async function () {
      const largeShares = ethers.parseEther("1000");
      const cost = await market.calculateBuyCost(0, largeShares);
      
      await expect(
        market.connect(user1).buyShares(0, largeShares, { value: cost })
      ).to.not.be.reverted;
    });

    it("Should maintain accuracy with repeated trades", async function () {
      // Execute multiple trades
      for (let i = 0; i < 10; i++) {
        const outcome = i % NUM_OUTCOMES;
        const shares = ethers.parseEther(String(i + 1));
        const cost = await market.calculateBuyCost(outcome, shares);
        await market.connect(user1).buyShares(outcome, shares, { value: cost });
      }
      
      // Prices should still sum to 1
      const prices = await market.getAllPrices();
      let sum = BigInt(0);
      
      for (let i = 0; i < NUM_OUTCOMES; i++) {
        sum += prices[i];
      }
      
      expect(sum).to.be.closeTo(ethers.parseEther("1"), ethers.parseEther("0.01"));
    });
  });
});