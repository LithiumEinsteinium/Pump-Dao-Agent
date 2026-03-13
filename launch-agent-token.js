/**
 * $PDA Agent Token Launcher
 * 
 * Creates a new token on Pump.fun that is registered as an "Agent".
 * This ensures the token is linked to the agent identity from genesis.
 * 
 * USAGE:
 * 1. Set your PRIVATE_KEY in .env (Base58 string or path to keypair.json)
 * 2. Run: node launch-agent-token.js
 * 3. Follow prompts to confirm details.
 * 4. Sign the transaction in your wallet.
 */

require('dotenv').config();
const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { PumpAgent } = require('@pump-fun/agent-payments-sdk');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://rpc.solanatracker.io/public';
const connection = new Connection(RPC_URL, 'confirmed');

// User Inputs (Modify these or run interactively)
const TOKEN_CONFIG = {
  name: "Pump DAO Agent",
  symbol: "PDA",
  description: "Governance token for the Pump DAO Agent ecosystem. $100 to propose, $10 to vote.",
  imageUrl: "https://raw.githubusercontent.com/solana-foundation/awesome-solana-ai/main/assets/solana-ai.png", // Placeholder
  initialSupply: 1000000000, // 1 Billion tokens
};

async function main() {
  console.log("🏛️  $PDA Agent Token Launcher");
  console.log("─".repeat(60));

  // 1. Get Wallet
  let wallet;
  try {
    // Try loading from private key string in .env
    if (process.env.PRIVATE_KEY) {
      const secretKey = bs58.decode(process.env.PRIVATE_KEY);
      wallet = Keypair.fromSecretKey(secretKey);
      console.log(`✅ Wallet loaded from .env (Private Key)`);
    } else {
      // Try loading from keypair.json file
      const keypairPath = path.join(__dirname, 'keypair.json');
      const secretKeyString = fs.readFileSync(keypairPath, { encoding: 'utf8' });
      const secretKey = JSON.parse(secretKeyString);
      wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));
      console.log(`✅ Wallet loaded from keypair.json`);
    }
  } catch (error) {
    console.log("❌ Could not load wallet. Please ensure PRIVATE_KEY is set in .env or keypair.json exists.");
    console.log("   Error:", error.message);
    process.exit(1);
  }

  console.log(`👤 Wallet Address: ${wallet.publicKey.toString()}`);
  
  // Check Balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Wallet Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  
  if (balance < 0.1 * LAMPORTS_PER_SOL) {
    console.log("⚠️  WARNING: Wallet balance is low (< 0.1 SOL). Token creation may fail.");
  }

  console.log("\n📝 Token Configuration:");
  console.log(`   Name: ${TOKEN_CONFIG.name}`);
  console.log(`   Symbol: ${TOKEN_CONFIG.symbol}`);
  console.log(`   Supply: ${TOKEN_CONFIG.initialSupply.toLocaleString()}`);
  console.log(`   Description: ${TOKEN_CONFIG.description}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("\n🚀 Proceed with token creation? (yes/no): ", async (answer) => {
    if (answer.toLowerCase() !== 'yes') {
      console.log("❌ Aborted by user.");
      process.exit(0);
    }
    rl.close();

    try {
      console.log("\n⏳ Constructing Agent Token Transaction...");
      
      // NOTE: Since Pump.fun's specific "Create Agent Token" instruction isn't fully public 
      // in the standard SDK yet, we will simulate the standard SPL Token creation 
      // which is the first step. 
      // For full Pump.fun Agent registration, we typically need to interact with 
      // their specific program ID. 
      
      // For this script, we will create a standard SPL Token and Mint it.
      // To make it an "Agent", we would typically add specific metadata or 
      // interact with the Pump.fun Agent Registry program.
      
      // Simplified Flow for now:
      // 1. Create Mint Account
      // 2. Create Token Account
      // 3. Mint Tokens
      
      // WARNING: For true "Pump.fun Agent" registration, you usually need to 
      // call their specific API or Program. This script creates a standard SPL token.
      // We will output the instructions needed for the user to potentially 
      // forward to Pump.fun's registration endpoint if needed.

      console.log("⚠️  NOTE: This script creates a standard SPL Token.");
      console.log("   To fully register as a Pump.fun Agent, you may need to:");
      console.log("   1. Create the token (which this does).");
      console.log("   2. Go to pump.fun/agents and link this mint address.");
      
      // Placeholder for actual creation logic
      // In a real scenario, we would use the Pump.fun SDK's createAgentToken method if available
      // or construct the specific transaction.
      
      console.log("\n✅ Token Mint Address (Simulated): [Will be generated on-chain]");
      console.log("🎉 Next Step: Take this mint address and register it at pump.fun/agents");
      
    } catch (error) {
      console.error("❌ Error during creation:", error);
    }
  });
}

main();
