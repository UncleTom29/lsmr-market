export const CONTRACT_ABI =  [
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_numOutcomes",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_b0",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_alpha",
          "type": "uint256"
        }
      ],
      "stateMutability": "payable",
      "type": "constructor"
    },
    {
      "inputs": [],
      "name": "InsufficientPayment",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InsufficientShares",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidDelta",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidInitialFunding",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidNumOutcomes",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "InvalidOutcome",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "MarketAlreadyResolved",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "NotResolved",
      "type": "error"
    },
    {
      "inputs": [],
      "name": "OnlyOwner",
      "type": "error"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "initialCollateral",
          "type": "uint256"
        }
      ],
      "name": "MarketFunded",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "winningOutcome",
          "type": "uint256"
        }
      ],
      "name": "MarketResolved",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "outcome",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "int256",
          "name": "amount",
          "type": "int256"
        }
      ],
      "name": "SharesTransferred",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "DECIMALS",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "alpha",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "b0",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "claimWinnings",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "collateral",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        }
      ],
      "name": "getAllUserBalances",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getB",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getMarketInfo",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "_numOutcomes",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_b0",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_alpha",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_currentB",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_totalVolume",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "_collateral",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "_resolved",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "_winningOutcome",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getPrices",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "outcome",
          "type": "uint256"
        },
        {
          "internalType": "int256",
          "name": "delta",
          "type": "int256"
        }
      ],
      "name": "getTradeCost",
      "outputs": [
        {
          "internalType": "int256",
          "name": "cost",
          "type": "int256"
        },
        {
          "internalType": "uint256[]",
          "name": "newPrices",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "outcome",
          "type": "uint256"
        }
      ],
      "name": "getUserBalance",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "numOutcomes",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "quantities",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_winningOutcome",
          "type": "uint256"
        }
      ],
      "name": "resolveMarket",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "resolved",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "shareBalances",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalVolume",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "winningOutcome",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]

export const CONTRACT_ADDRESS = "0x631bd842064962E084cDc6Db0D47679e4C19982C";
export const SEPOLIA_CHAIN_ID = 84532;