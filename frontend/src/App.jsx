import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Settings, BarChart3, RefreshCw } from 'lucide-react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { ethers } from 'ethers';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from './config.js';

const LSLMSRApp = () => {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [contract, setContract] = useState(null);
  const [numOutcomes, setNumOutcomes] = useState(2);
  const [prices, setPrices] = useState([]);
  const [quantities, setQuantities] = useState([]);
  const [userShares, setUserShares] = useState([]);
  const [marketInfo, setMarketInfo] = useState(null);
  
  const [selectedOutcome, setSelectedOutcome] = useState(0);
  const [shareAmount, setShareAmount] = useState('10');
  const [tradeType, setTradeType] = useState('buy');
  const [tradeCost, setTradeCost] = useState('0');
  const [newPricesPreview, setNewPricesPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [priceHistory, setPriceHistory] = useState([]);
  const [txStatus, setTxStatus] = useState('');

  // Initialize contract when wallet is connected
  useEffect(() => {
    if (isConnected && walletClient) {
      initializeContract();
    } else {
      setContract(null);
    }
  }, [isConnected, walletClient]);

  const initializeContract = async () => {
    try {
      // Convert walletClient to ethers signer
      const provider = new ethers.BrowserProvider(walletClient);
      const signer = await provider.getSigner();
      
      const marketContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      setContract(marketContract);
      
      await loadMarketData(marketContract, address);
    } catch (error) {
      console.error('Error initializing contract:', error);
      setTxStatus('Error initializing contract: ' + error.message);
    }
  };

  // Load market data
  const loadMarketData = async (marketContract, userAddress) => {
    try {
      setTxStatus('Loading market data...');
      
      // Get market info
      const info = await marketContract.getMarketInfo();
      const outcomes = Number(info[0]);
      
      setNumOutcomes(outcomes);
      setMarketInfo({
        numOutcomes: outcomes,
        b0: ethers.formatEther(info[1]),
        alpha: ethers.formatEther(info[2]),
        currentB: ethers.formatEther(info[3]),
        totalVolume: ethers.formatEther(info[4]),
        collateral: ethers.formatEther(info[5]),
        resolved: info[6],
        winningOutcome: Number(info[7])
      });

      // Get prices
      const allPrices = await marketContract.getPrices();
      setPrices(allPrices.map(p => Number(ethers.formatEther(p))));

      // Get quantities for each outcome
      const allQuantities = [];
      for (let i = 0; i < outcomes; i++) {
        const qty = await marketContract.quantities(i);
        allQuantities.push(Number(ethers.formatEther(qty)));
      }
      setQuantities(allQuantities);

      // Get user shares
      const allUserShares = await marketContract.getAllUserBalances(userAddress);
      setUserShares(allUserShares.map(s => Number(ethers.formatEther(s))));

      setTxStatus('');
    } catch (error) {
      console.error('Error loading market data:', error);
      setTxStatus('Error loading market data: ' + error.message);
      setTimeout(() => setTxStatus(''), 5000);
    }
  };

  // Calculate trade cost
  const calculateTrade = async () => {
    if (!contract || !shareAmount || Number(shareAmount) <= 0) {
      setTradeCost('0');
      setNewPricesPreview([]);
      return;
    }

    try {
      const shares = ethers.parseEther(shareAmount);
      const delta = tradeType === 'buy' ? shares : -shares;
      
      const result = await contract.getTradeCost(selectedOutcome, delta);
      const cost = result[0];
      const newPrices = result[1];

      if (tradeType === 'buy') {
        setTradeCost(ethers.formatEther(cost));
      } else {
        setTradeCost(ethers.formatEther(-cost));
      }

      setNewPricesPreview(newPrices.map(p => Number(ethers.formatEther(p))));
    } catch (error) {
      console.error('Error calculating trade:', error);
      setTradeCost('0');
      setNewPricesPreview([]);
    }
  };

  // Execute trade
  const executeTrade = async () => {
    if (!contract) return;
    
    setLoading(true);
    setTxStatus('Preparing transaction...');

    try {
      const shares = ethers.parseEther(shareAmount);
      const delta = tradeType === 'buy' ? shares : -shares;

      // Get the cost first
      const result = await contract.getTradeCost(selectedOutcome, delta);
      const cost = result[0];

      let tx;
      if (tradeType === 'buy') {
        setTxStatus('Confirm transaction in wallet...');
        tx = await contract.trade(selectedOutcome, delta, { 
          value: cost,
          gasLimit: 500000 
        });
      } else {
        if (userShares[selectedOutcome] < Number(shareAmount)) {
          alert('Insufficient shares to sell');
          setLoading(false);
          setTxStatus('');
          return;
        }
        setTxStatus('Confirm transaction in wallet...');
        tx = await contract.trade(selectedOutcome, delta, {
          gasLimit: 500000
        });
      }

      setTxStatus('Waiting for confirmation...');
      const receipt = await tx.wait();
      
      setTxStatus('Transaction confirmed! Updating data...');
      
      // Update price history
      const newPrices = await contract.getPrices();
      const historyEntry = {
        time: priceHistory.length,
        ...newPrices.map((p, idx) => ({
          [`Outcome ${idx + 1}`]: (Number(ethers.formatEther(p)) * 100).toFixed(2)
        })).reduce((acc, curr) => ({ ...acc, ...curr }), {})
      };
      setPriceHistory([...priceHistory, historyEntry]);

      await loadMarketData(contract, address);
      
      setTxStatus('✅ Trade successful!');
      setTimeout(() => setTxStatus(''), 3000);
      
    } catch (error) {
      console.error('Trade error:', error);
      let errorMsg = error.message;
      if (error.reason) errorMsg = error.reason;
      if (error.data?.message) errorMsg = error.data.message;
      if (error.code === 'ACTION_REJECTED') errorMsg = 'Transaction rejected by user';
      
      setTxStatus('❌ Trade failed: ' + errorMsg);
      setTimeout(() => setTxStatus(''), 5000);
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const refreshData = async () => {
    if (contract && address) {
      await loadMarketData(contract, address);
    }
  };

  // Calculate trade when inputs change
  useEffect(() => {
    if (isConnected && contract) {
      calculateTrade();
    }
  }, [shareAmount, selectedOutcome, tradeType, isConnected, contract]);

  const outcomeColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                LS-LMSR Prediction Market
              </h1>
              <p className="text-slate-400">Liquidity-Sensitive LMSR • Base Sepolia Testnet</p>
            </div>
            <div className="flex gap-3 items-center">
              {isConnected && (
                <button
                  onClick={refreshData}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              )}
              <ConnectButton />
            </div>
          </div>
        </div>

        {!isConnected ? (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-12 border border-slate-700 text-center">
            <div className="w-16 h-16 mx-auto mb-4">
              <svg viewBox="0 0 24 24" fill="none" className="text-blue-400">
                <path d="M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v10z" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className="text-slate-400 mb-6">Connect your wallet to start trading on the prediction market</p>
            
            <div className="flex justify-center">
              <ConnectButton />
            </div>
            
            <div className="mt-8 text-sm text-slate-500">
              <p className="mt-2">Need Sepolia ETH? <a href="https://sepoliafaucet.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Get it from the faucet</a></p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Market Info */}
            <div className="lg:col-span-1 space-y-6">
              {marketInfo && (
                <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                  <div className="flex items-center mb-4">
                    <Settings className="w-5 h-5 mr-2 text-blue-400" />
                    <h2 className="text-xl font-bold">Market Parameters</h2>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Outcomes:</span>
                      <span className="font-semibold">{marketInfo.numOutcomes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Base b₀:</span>
                      <span className="font-semibold">{Number(marketInfo.b0).toFixed(4)} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Current b:</span>
                      <span className="font-semibold">{Number(marketInfo.currentB).toFixed(4)} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Alpha (α):</span>
                      <span className="font-semibold">{Number(marketInfo.alpha).toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Volume (Q):</span>
                      <span className="font-semibold">{Number(marketInfo.totalVolume).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Pool:</span>
                      <span className="font-semibold">{Number(marketInfo.collateral).toFixed(4)} ETH</span>
                    </div>
                    {marketInfo.resolved && (
                      <div className="mt-4 p-2 bg-green-500/20 border border-green-500 rounded">
                        <div className="text-center text-green-400 font-bold">
                          Winner: Outcome {marketInfo.winningOutcome + 1}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Current Prices */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="flex items-center mb-4">
                  <BarChart3 className="w-5 h-5 mr-2 text-green-400" />
                  <h2 className="text-xl font-bold">Current Prices</h2>
                </div>
                
                <div className="space-y-3">
                  {prices.map((price, idx) => (
                    <div key={idx} className="bg-slate-700/50 rounded-lg p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium" style={{ color: outcomeColors[idx] }}>
                          Outcome {idx + 1}
                        </span>
                        <span className="text-lg font-bold">{(price * 100).toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-slate-600 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${price * 100}%`,
                            backgroundColor: outcomeColors[idx]
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>Qty: {quantities[idx]?.toFixed(2) || '0'}</span>
                        <span>Yours: {userShares[idx]?.toFixed(2) || '0'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Trading Panel & Chart */}
            <div className="lg:col-span-2 space-y-6">
              {/* Trading Interface */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <div className="flex items-center mb-4">
                  <TrendingUp className="w-5 h-5 mr-2 text-cyan-400" />
                  <h2 className="text-xl font-bold">Trade Shares</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <button
                    onClick={() => setTradeType('buy')}
                    className={`py-3 rounded-lg font-semibold transition-all ${
                      tradeType === 'buy'
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Buy Shares
                  </button>
                  <button
                    onClick={() => setTradeType('sell')}
                    className={`py-3 rounded-lg font-semibold transition-all ${
                      tradeType === 'sell'
                        ? 'bg-red-500 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    Sell Shares
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Select Outcome</label>
                    <select
                      value={selectedOutcome}
                      onChange={(e) => setSelectedOutcome(Number(e.target.value))}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {prices.map((price, idx) => (
                        <option key={idx} value={idx}>
                          Outcome {idx + 1} ({(price * 100).toFixed(2)}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Number of Shares
                    </label>
                    <input
                      type="number"
                      value={shareAmount}
                      onChange={(e) => setShareAmount(e.target.value)}
                      min="0.01"
                      step="1"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="bg-slate-700/50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-400">
                        {tradeType === 'buy' ? 'Cost:' : 'Payout:'}
                      </span>
                      <span className={`text-2xl font-bold ${tradeType === 'buy' ? 'text-red-400' : 'text-green-400'}`}>
                        {Number(tradeCost).toFixed(6)} ETH
                      </span>
                    </div>
                    {newPricesPreview.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-600">
                        <div className="text-xs text-slate-400 mb-2">Price impact:</div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {newPricesPreview.map((newPrice, idx) => {
                            const change = ((newPrice - prices[idx]) / prices[idx] * 100);
                            return (
                              <div key={idx} className="flex justify-between">
                                <span className="text-slate-400">Out. {idx + 1}:</span>
                                <span className={change > 0 ? 'text-green-400' : change < 0 ? 'text-red-400' : ''}>
                                  {change > 0 ? '+' : ''}{change.toFixed(2)}%
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {txStatus && (
                    <div className={`rounded-lg p-3 text-center ${
                      txStatus.includes('✅') ? 'bg-green-500/20 border border-green-500 text-green-400' :
                      txStatus.includes('❌') ? 'bg-red-500/20 border border-red-500 text-red-400' :
                      'bg-blue-500/20 border border-blue-500 text-blue-400'
                    }`}>
                      {txStatus}
                    </div>
                  )}

                  <button
                    onClick={executeTrade}
                    disabled={loading || !shareAmount || Number(shareAmount) <= 0}
                    className={`w-full py-4 rounded-lg font-bold text-lg transition-all ${
                      loading || !shareAmount || Number(shareAmount) <= 0
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 shadow-lg shadow-blue-500/50'
                    }`}
                  >
                    {loading ? 'Processing...' : `Execute ${tradeType === 'buy' ? 'Buy' : 'Sell'} Order`}
                  </button>
                </div>
              </div>

              {/* Price History Chart */}
              <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
                <h2 className="text-xl font-bold mb-4">Price History</h2>
                {priceHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" label={{ value: 'Trade #', position: 'insideBottom', offset: -5 }} />
                      <YAxis stroke="#94a3b8" label={{ value: 'Price (%)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      />
                      <Legend />
                      {Array.from({ length: numOutcomes }, (_, idx) => (
                        <Line
                          key={idx}
                          type="monotone"
                          dataKey={`Outcome ${idx + 1}`}
                          stroke={outcomeColors[idx]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-400">
                    Execute trades to see price history
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LSLMSRApp;