// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LSLMSRMarket
 * @notice Liquidity-Sensitive Logarithmic Market Scoring Rule prediction market
 * @dev Implements LS-LMSR with exponential liquidity scaling: b = b0 * exp(α * Q)
 */
contract LSLMSRMarket {
    
    uint256 public constant DECIMALS = 1e18;
    
   
    uint256 public immutable numOutcomes;
    uint256 public immutable b0;           // Base liquidity parameter 
    uint256 public immutable alpha;        // Sensitivity parameter 
    
 
    uint256[] public quantities;           // Outstanding shares for each outcome
    uint256 public totalVolume;            // Cumulative |delta| across all trades
    uint256 public collateral;             // Total collateral in the pool
    
    mapping(address => uint256[]) public shareBalances;  // User share holdings
    
    bool public resolved;
    uint256 public winningOutcome;
    address public owner;

    event SharesTransferred(address indexed user, uint256 indexed outcome, int256 amount);
    event MarketFunded(uint256 initialCollateral);
    event MarketResolved(uint256 indexed winningOutcome);
    

    error InvalidOutcome();
    error InvalidDelta();
    error InsufficientPayment();
    error InsufficientShares();
    error InvalidNumOutcomes();
    error InvalidInitialFunding();
    error MarketAlreadyResolved();
    error OnlyOwner();
    error NotResolved();
 
    constructor(uint256 _numOutcomes, uint256 _b0, uint256 _alpha) payable {
        if (_numOutcomes < 2 || _numOutcomes > 5) revert InvalidNumOutcomes();
        
        numOutcomes = _numOutcomes;
        b0 = _b0;
        alpha = _alpha;
        owner = msg.sender;
        
        quantities = new uint256[](_numOutcomes);
        shareBalances[msg.sender] = new uint256[](_numOutcomes);
        
        // Calculate initial cost: C(0) = b * ln(n)
        uint256 initialB = getB();
        uint256 lnN = ln(_numOutcomes * DECIMALS);
        uint256 initialC = (initialB * lnN) / DECIMALS;
        
        if (msg.value != initialC) revert InvalidInitialFunding();
        
        collateral = initialC;
        emit MarketFunded(initialC);
    }
    
    function getB() public view returns (uint256) {
        // k = α * Q
        uint256 k = (alpha * totalVolume) / DECIMALS;
        
        // b = b0 * exp(k)
        uint256 expK = exp(k);
        return (b0 * expK) / DECIMALS;
    }
    
  
  function computeC(uint256[] memory _quantities) internal view returns (uint256) {
    uint256 b = getB();
    
    // Find maxQ
    uint256 maxQ = _quantities[0];
    for (uint256 i = 1; i < numOutcomes; i++) {
        if (_quantities[i] > maxQ) maxQ = _quantities[i];
    }
    
    // sum_rel = sum exp( (q_i - maxQ)/b ) * DECIMALS
    uint256 sumRel = 0;
    for (uint256 i = 0; i < numOutcomes; i++) {
        uint256 delta = maxQ > _quantities[i] ? maxQ - _quantities[i] : 0;
        uint256 argRel = (delta * DECIMALS) / b;
        
        uint256 expRel;
        if (argRel == 0) {
            expRel = DECIMALS;
        } else {
            uint256 expPos = exp(argRel);
            expRel = expPos == 0 ? 0 : (DECIMALS * DECIMALS) / expPos;
        }
        
        sumRel += expRel;
    }
    
    // C = maxQ + b * ln(sum_rel / DECIMALS) * DECIMALS, but scaled
    uint256 lnSumRel = ln(sumRel);
    uint256 cAdd = (b * lnSumRel) / DECIMALS;
    return maxQ + cAdd;
}
  function getPrices() public view returns (uint256[] memory) {
    return _computePrices(quantities);
}


    function getTradeCost(uint256 outcome, int256 delta) 
    public 
    view 
    returns (int256 cost, uint256[] memory newPrices) 
{
    if (outcome >= numOutcomes) revert InvalidOutcome();
    if (delta == 0) revert InvalidDelta();
    
    uint256 absDelta = uint256(delta > 0 ? delta : -delta);
    
    // Calculate new quantities
    uint256[] memory newQ = new uint256[](numOutcomes);
    for (uint256 i = 0; i < numOutcomes; i++) {
        newQ[i] = quantities[i];
    }
    
    if (delta > 0) {
        newQ[outcome] += absDelta;
    } else {
        if (newQ[outcome] < absDelta) revert InsufficientShares();
        newQ[outcome] -= absDelta;
    }
    
    // Cost
    uint256 newC = computeC(newQ);
    cost = int256(newC) - int256(collateral);
    
    // New prices (stable)
    newPrices = _computePrices(newQ);
}
    function resolveMarket(uint256 _winningOutcome) external {
        if (msg.sender != owner) revert OnlyOwner();
        if (resolved) revert MarketAlreadyResolved();
        if (_winningOutcome >= numOutcomes) revert InvalidOutcome();
        
        resolved = true;
        winningOutcome = _winningOutcome;
        
        emit MarketResolved(_winningOutcome);
    }
    
 
    function claimWinnings() external {
        if (!resolved) revert NotResolved();
        
        if (shareBalances[msg.sender].length == 0) {
            revert InsufficientShares();
        }
        
        uint256 shares = shareBalances[msg.sender][winningOutcome];
        if (shares == 0) revert InsufficientShares();
        
        shareBalances[msg.sender][winningOutcome] = 0;
        
        // Each winning share pays out 1 unit (1e18 wei)
        payable(msg.sender).transfer(shares);
    }
  
    function getUserBalance(address user, uint256 outcome) external view returns (uint256) {
        uint256[] storage bal = shareBalances[user];
        return bal.length > 0 ? bal[outcome] : 0;
    }
    

    function getAllUserBalances(address user) external view returns (uint256[] memory) {
        if (shareBalances[user].length == 0) {
            return new uint256[](numOutcomes);
        }
        return shareBalances[user];
    }

    
    /**
     * @notice Natural logarithm using Taylor series
     * @dev Input must be positive and scaled by 1e18
     * @param x Input value (scaled by 1e18)
     * @return Natural log (scaled by 1e18)
     */
    function ln(uint256 x) internal pure returns (uint256) {
        require(x > 0, "ln: x must be positive");
        
        // For x close to 1, use Taylor series
        // Transform to range [1, 2) for better convergence
        
        uint256 result = 0;
        uint256 y = x;
        
        // Scale to [1, 2) range
        uint256 k = 0;
        while (y >= 2 * DECIMALS) {
            y = y / 2;
            k++;
        }
        while (y < DECIMALS) {
            y = y * 2;
            k--;
        }
        
        // Taylor series: ln(1+z) = z - z²/2 + z³/3 - z⁴/4 + ...
        uint256 z = y - DECIMALS;
        uint256 zPower = z;
        
        for (uint256 i = 1; i <= 10; i++) {
            if (i % 2 == 1) {
                result += zPower / i;
            } else {
                result -= zPower / i;
            }
            zPower = (zPower * z) / DECIMALS;
        }
        
        // ln(2) ≈ 0.693147180559945309
        uint256 LN2 = 693147180559945309;
        
        if (k >= 0) {
            result = result + (k * LN2);
        } else {
            result = result - (uint256(-int256(k)) * LN2);
        }
        
        return result;
    }
    
    /**
     * @notice Exponential function using Taylor series
     * @dev Input scaled by 1e18
     * @param x Input value (scaled by 1e18)
     * @return e^x (scaled by 1e18)
     */
    function exp(uint256 x) internal pure returns (uint256) {
       
        if (x == 0) return DECIMALS;
        if (x >= 50 * DECIMALS) return type(uint256).max; 
        
        // Split into integer and fractional parts
        uint256 intPart = x / DECIMALS;
        uint256 fracPart = x % DECIMALS;
        
        // Calculate e^intPart using repeated multiplication
        // e ≈ 2.718281828459045235
        uint256 E = 2718281828459045235;
        uint256 intResult = DECIMALS;
        
        for (uint256 i = 0; i < intPart; i++) {
            intResult = (intResult * E) / DECIMALS;
        }
        
        // Calculate e^fracPart using Taylor series
        // e^x = 1 + x + x²/2! + x³/3! + ...
        uint256 fracResult = DECIMALS;
        uint256 term = fracPart;
        
        for (uint256 i = 1; i <= 20; i++) {
            fracResult += term;
            term = (term * fracPart) / (DECIMALS * (i + 1));
            if (term == 0) break;
        }
        
        return (intResult * fracResult) / DECIMALS;
    }
    
    function getMarketInfo() external view returns (
        uint256 _numOutcomes,
        uint256 _b0,
        uint256 _alpha,
        uint256 _currentB,
        uint256 _totalVolume,
        uint256 _collateral,
        bool _resolved,
        uint256 _winningOutcome
    ) {
        return (
            numOutcomes,
            b0,
            alpha,
            getB(),
            totalVolume,
            collateral,
            resolved,
            winningOutcome
        );
    }

    function _computePrices(uint256[] memory _quantities) internal view returns (uint256[] memory) {
    uint256[] memory prices = new uint256[](numOutcomes);
    uint256 b = getB();
    
    if (numOutcomes == 0 || b == 0) {
        // Fallback: equal if invalid
        uint256 equal = DECIMALS / numOutcomes;
        for (uint256 i = 0; i < numOutcomes; i++) prices[i] = equal;
        return prices;
    }
    
    // Find maxQ for relative exps
    uint256 maxQ = _quantities[0];
    for (uint256 i = 1; i < numOutcomes; i++) {
        if (_quantities[i] > maxQ) maxQ = _quantities[i];
    }
    
    uint256 sumRel = 0;
    uint256[] memory relExps = new uint256[](numOutcomes);
    
    for (uint256 i = 0; i < numOutcomes; i++) {
        uint256 delta = maxQ > _quantities[i] ? maxQ - _quantities[i] : 0;
        uint256 argRel = (delta * DECIMALS) / b;
        
        uint256 expRel;
        if (argRel == 0) {
            expRel = DECIMALS;
        } else {
            uint256 expPos = exp(argRel);
            expRel = expPos == 0 ? 0 : (DECIMALS * DECIMALS) / expPos;
        }
        
        relExps[i] = expRel;
        sumRel += expRel;
    }
    
    if (sumRel == 0) {
        // Extreme case: equal fallback
        uint256 equal = DECIMALS / numOutcomes;
        for (uint256 i = 0; i < numOutcomes; i++) prices[i] = equal;
    } else {
        for (uint256 i = 0; i < numOutcomes; i++) {
            prices[i] = (relExps[i] * DECIMALS) / sumRel;
        }
    }
    
    return prices;
}
}