/**
 * Gatekeeper Module
 * Verifies user token holdings against dynamic USD thresholds.
 * Uses real-time price from Jupiter/Pyth to calculate value.
 */

const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');

const CONFIG = {
  PROPOSAL_THRESHOLD_USD: parseFloat(process.env.PROPOSAL_THRESHOLD_USD) || 100,
  VOTE_THRESHOLD_USD: parseFloat(process.env.VOTE_THRESHOLD_USD) || 10,
  SOLANA_RPC: process.env.SOLANA_RPC_URL || 'https://rpc.solanatracker.io/public',
  AGENT_TOKEN_MINT: process.env.AGENT_TOKEN_MINT_ADDRESS,
};

const connection = new Connection(CONFIG.SOLANA_RPC, 'confirmed');

/**
 * Fetches real-time token price in USD via Jupiter Price API
 * @param {string} tokenMint - Token mint address
 * @returns {Promise<number>} - Price in USD
 */
async function getTokenPrice(tokenMint) {
  try {
    // Jupiter Price API (free, no key needed)
    const response = await axios.get(
      `https://price.jup.ag/v6/price?ids=${tokenMint}&vsToken=USDC`
    );
    
    const priceData = response.data.data[tokenMint];
    if (!priceData || !priceData.price) {
      throw new Error('Price not found for token');
    }
    
    return parseFloat(priceData.price);
  } catch (error) {
    console.error('Error fetching price:', error.message);
    // Fallback: Try Pyth Network if Jupiter fails
    throw new Error(`Price fetch failed: ${error.message}`);
  }
}

/**
 * Gets user's token balance (raw amount, not value)
 * @param {string} userAddress - User's wallet address
 * @param {string} tokenMint - Token mint address
 * @returns {Promise<number>} - Raw token balance
 */
async function getTokenBalance(userAddress, tokenMint) {
  try {
    const owner = new PublicKey(userAddress);
    const mint = new PublicKey(tokenMint);
    
    // Find user's token account
    const tokenAccount = await connection.getTokenAccountsByOwner(owner, {
      mint: mint,
    });
    
    if (tokenAccount.value.length === 0) {
      return 0; // User has no token account
    }
    
    // Get balance from first token account
    const accountInfo = await connection.getAccountInfo(tokenAccount.value[0].pubkey);
    // Parse SPL Token account data (offset 64, length 8 for amount)
    const amount = accountInfo.data.readBigUInt64LE(64);
    
    return Number(amount);
  } catch (error) {
    console.error('Error fetching balance:', error.message);
    return 0;
  }
}

/**
 * Main verification function
 * Checks if user meets the threshold for a specific action
 * 
 * @param {string} userAddress - User's wallet address
 * @param {'propose' | 'vote'} action - Action type
 * @returns {Promise<{eligible: boolean, holdings: number, required: number, message: string}>}
 */
async function verifyEligibility(userAddress, action) {
  if (!CONFIG.AGENT_TOKEN_MINT) {
    throw new Error('AGENT_TOKEN_MINT_ADDRESS not configured');
  }
  
  const threshold = action === 'propose' 
    ? CONFIG.PROPOSAL_THRESHOLD_USD 
    : CONFIG.VOTE_THRESHOLD_USD;
  
  try {
    // 1. Get token price
    const price = await getTokenPrice(CONFIG.AGENT_TOKEN_MINT);
    
    // 2. Get user balance
    const rawBalance = await getTokenBalance(userAddress, CONFIG.AGENT_TOKEN_MINT);
    
    // 3. Get token decimals (assume 6 for now, should fetch dynamically)
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(CONFIG.AGENT_TOKEN_MINT));
    const decimals = mintInfo.value?.data?.parsed?.info?.decimals || 6;
    const balance = rawBalance / Math.pow(10, decimals);
    
    // 4. Calculate USD value
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
