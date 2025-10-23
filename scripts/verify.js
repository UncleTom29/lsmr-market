const hre = require("hardhat");

// Replace with your deployed contract address
const CONTRACT_ADDRESS = "0x631bd842064962E084cDc6Db0D47679e4C19982C";

// Constructor arguments used during deployment
const NUM_OUTCOMES = 2;
const B0 = hre.ethers.parseEther("0.01");  // 0.01 ETH
const ALPHA = hre.ethers.parseEther("0.01");  // 0.01

async function main() {
  console.log("🔍 Verifying LSLMSRMarket contract...\n");
  
  console.log("Contract Address:", CONTRACT_ADDRESS);
  console.log("Network:", hre.network.name);
  console.log("\nConstructor Arguments:");
  console.log("  numOutcomes:", NUM_OUTCOMES);
  console.log("  b0:", B0.toString(), `(${hre.ethers.formatEther(B0)} ETH)`);
  console.log("  alpha:", ALPHA.toString(), `(${hre.ethers.formatEther(ALPHA)})`);
  console.log("");

  try {
    console.log("Submitting for verification...");
    
    await hre.run("verify:verify", {
      address: CONTRACT_ADDRESS,
      constructorArguments: [
        NUM_OUTCOMES,
        B0,
        ALPHA
      ],
      // Use API v2
      apiKey: process.env.ETHERSCAN_API_KEY,
    });

    console.log("\n✅ Contract verified successfully!");
    console.log(`\nView on Etherscan:`);
    
    if (hre.network.name === "sepolia") {
      console.log(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}#code`);
    } else if (hre.network.name === "baseSepolia") {
      console.log(`https://sepolia.basescan.org/address/${CONTRACT_ADDRESS}#code`);
    } else if (hre.network.name === "mainnet") {
      console.log(`https://etherscan.io/address/${CONTRACT_ADDRESS}#code`);
    }

  } catch (error) {
    if (error.message.includes("Already Verified")) {
      console.log("\n✅ Contract is already verified!");
      
      if (hre.network.name === "sepolia") {
        console.log(`\nView on Etherscan:`);
        console.log(`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}#code`);
      }
    } else if (error.message.includes("deprecated")) {
      console.error("\n❌ API Version Error:");
      console.error("Your Hardhat configuration is using deprecated Etherscan API v1");
      console.log("\n📝 Fix this by updating hardhat.config.js:");
      console.log("Add this to your config:\n");
      console.log("etherscan: {");
      console.log("  apiKey: {");
      console.log("    sepolia: process.env.ETHERSCAN_API_KEY");
      console.log("  }");
      console.log("}");
      console.log("\nAnd make sure you have ETHERSCAN_API_KEY in your .env file");
    } else {
      console.error("\n❌ Verification failed:");
      console.error(error.message);
      
      console.log("\n💡 Troubleshooting tips:");
      console.log("1. Make sure constructor arguments match deployment");
      console.log("2. Wait a few blocks after deployment before verifying");
      console.log("3. Check that ETHERSCAN_API_KEY is set in .env");
      console.log("4. Verify you're on the correct network");
      
      console.log("\n📝 Manual verification command:");
      console.log(`npx hardhat verify --network ${hre.network.name} \\`);
      console.log(`  ${CONTRACT_ADDRESS} \\`);
      console.log(`  ${NUM_OUTCOMES} \\`);
      console.log(`  "${B0.toString()}" \\`);
      console.log(`  "${ALPHA.toString()}"`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });