/**
 * Gatekeeper Module
 * Verifies user token holdings against dynamic USD thresholds.
 * Uses CoinGecko API for reliable price fetching on cloud hosts.
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

const CONFIG = {
  PROPOSAL_THRESHOLD_USD: parseFloat(process.env.PROPOSAL_THRESHOLD_USD) || 100,
  VOTE_THRESHOLD_USD: parseFloat(process.env.VOTE_THRESHOLD_USD) || 10,
  // Use Solana Foundation's public RPC as default (works for read requests)
  SOLANA_RPC_HTTP: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  AGENT_TOKEN_MINT: process.env.AGENT_TOKEN_MINT_ADDRESS,
  MOCK_MODE: process.env.MOCK_MODE === 'true',
  // API Fee: 0.0025 SOL per call
  API_FEE_LAMPORTS: 2500000, // 0.0025 SOL in lamports
};

const connection = new Connection(CONFIG.SOLANA_RPC_HTTP, 'confirmed');

// Hardcoded Stablecoins
const STABLECOINS = [
  'epjfwdd5aufqssqeM2qN1xzybapC8G4wEGGkZwyTDt1v'.toLowerCase(), // USDC
];

/**
 * Fetches real-time token price in USD via CoinGecko.
 * Works for any token listed on CoinGecko with a Solana contract address.
 */
async function getTokenPrice(tokenMint) {
  const mintLower = tokenMint ? tokenMint.toString().toLowerCase().trim() : '';
  
  // 1. Hardcoded Stablecoins (USDC)
  if (STABLECOINS.includes(mintLower)) {
    return 1.0;
  }

  // 2. Fetch from CoinGecko
  // We use the /coins/{id}/contract/{address} endpoint or simple price if we know the ID.
  // Since we don't know the CoinGecko ID for every token, we try to fetch by contract address.
  // Note: CoinGecko's free API is rate-limited. For production, consider an API key.
  
  try {
    // Attempt 1: Try to find price by contract address (Solana)
    // This endpoint often works: /coins/solana/contract/{address}
    // But it returns full coin data. Let's try the simpler approach first:
    // We assume the token is listed on CoinGecko.
    
    // Alternative: Use Jupiter via a proxy? No, let's stick to CoinGecko.
    // The most reliable way without an API Key is to hope the token ID is known or use a mapping.
    // BUT, CoinGecko has a specific endpoint for contract addresses!
    
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${tokenMint}&vs_currencies=usd`,
      { timeout: 10000 }
    );
    
    const data = response.data;
    if (data && data[mintLower] && data[mintLower].usd) {
      return parseFloat(data[mintLower].usd);
    }
    
    throw new Error('Price not found on CoinGecko for this mint');
    
  } catch (error) {
    console.error('CoinGecko price fetch failed:', error.message);
    throw new Error(`Price fetch failed: ${error.message}`);
  }
}

/**
 * Gets user's token balance
 */
async function getTokenBalance(userAddress, tokenMint) {
  try {
    const owner = new PublicKey(userAddress);
    const mint = new PublicKey(tokenMint);
    
    const tokenAccount = await connection.getTokenAccountsByOwner(owner, {
      mint: mint,
    });
    
    if (tokenAccount.value.length === 0) {
      return 0;
    }
    
    const accountInfo = await connection.getAccountInfo(tokenAccount.value[0].pubkey);
    const amount = accountInfo.data.readBigUInt64LE(64);
    
    return Number(amount);
  } catch (error) {
    console.error('Error fetching balance:', error.message);
    return 0;
  }
}

/**
 * Main verification function
 */
async function verifyEligibility(userAddress, action) {
  if (!CONFIG.AGENT_TOKEN_MINT) {
    throw new Error('AGENT_TOKEN_MINT_ADDRESS not configured');
  }
  
  const threshold = action === 'propose' 
    ? CONFIG.PROPOSAL_THRESHOLD_USD 
    : CONFIG.VOTE_THRESHOLD_USD;
  
  // Mock Mode for testing
  if (CONFIG.MOCK_MODE) {
    return {
      eligible: true,
      holdings: 150.00,
      required: threshold,
      message: `✅ [MOCK] Verified: $150.00 held (Required: $${threshold})`
    };
  }
  
  try {
    const price = await getTokenPrice(CONFIG.AGENT_TOKEN_MINT);
    const rawBalance = await getTokenBalance(userAddress, CONFIG.AGENT_TOKEN_MINT);
    
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(CONFIG.AGENT_TOKEN_MINT));
    const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 6;
    const balance = rawBalance / Math.pow(10, decimals);
    
    const holdingsUSD = balance * price;
    const eligible = holdingsUSD >= threshold;
    
    return {
      eligible,
      holdings: holdingsUSD,
      required: threshold,
      message: eligible 
        ? `✅ Verified: $${holdingsUSD.toFixed(2)} held (Required: $${threshold})`
        : `❌ Insufficient: $${holdingsUSD.toFixed(2)} held (Required: $${threshold})`
    };
    
  } catch (error) {
    return {
      eligible: false,
      holdings: 0,
      required: threshold,
      message: `Error: ${error.message}`
    };
  }
}

module.exports = {
  verifyEligibility,
  getTokenPrice,
  CONFIG
};


/**
 * Verify user has enough SOL for API fee
 */
async function verifySolFee(walletAddress) {
  try {
    const owner = new PublicKey(walletAddress);
    const balance = await connection.getBalance(owner);
    
    if (balance < CONFIG.API_FEE_LAMPORTS) {
      return {
        eligible: false,
        required: CONFIG.API_FEE_LAMPORTS / 1e9,
        held: balance / 1e9,
        message: `Insufficient SOL. Need ${(CONFIG.API_FEE_LAMPORTS / 1e9)} SOL for API fee`
      };
    }
    
    return {
      eligible: true,
      required: CONFIG.API_FEE_LAMPORTS / 1e9,
      held: balance / 1e9,
      message: `✓ Sufficient SOL for API fee (${balance / 1e9} SOL available)`
    };
  } catch (error) {
    throw new Error(`SOL balance check failed: ${error.message}`);
  }
}

module.exports = { verifyEligibility, verifySolFee, getTokenBalance };

