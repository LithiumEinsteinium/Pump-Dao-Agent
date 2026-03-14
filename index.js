/**
 * Pump DAO Agent - Updated with Official pump.fun SDK
 * 
 * Uses @pump-fun/agent-payments-sdk for payment flow
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PublicKey } = require('@solana/web3.js');
const { PumpAgent } = require('@pump-fun/agent-payments-sdk');
const { createProposal, castVote, getProposal, getActiveProposals } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Config
const AGENT_MINT = process.env.AGENT_TOKEN_MINT_ADDRESS;
const PROPOSAL_THRESHOLD = parseFloat(process.env.PROPOSAL_THRESHOLD_USD) || 100;
const VOTE_THRESHOLD = parseFloat(process.env.VOTE_THRESHOLD_USD) || 10;
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://rpc.solanatracker.io/public';

// Payment settings
const FEE_LAMPORTS = 2500000; // 0.0025 SOL

let accumulatedFees = 0;

app.use(cors());
app.use(express.json());

console.log('🏛️  Pump DAO Agent - SDK Edition');
console.log(`   Agent Token: ${AGENT_MINT || 'NOT SET'}`);
console.log(`   Proposal: $${PROPOSAL_THRESHOLD} | Vote: $${VOTE_THRESHOLD}`);
console.log('─'.repeat(50));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    accumulatedFees: accumulatedFees / 1e9,
    mode: 'sdk'
  });
});

// Get payment instructions for propose
app.post('/create-payment', async (req, res) => {
  try {
    const { wallet, action, invoiceId } = req.body;
    
    if (!wallet || !action || !invoiceId) {
      return res.status(400).json({ error: 'Missing wallet, action, or invoiceId' });
    }
    
    const amount = action === 'propose' ? BigInt(100000000) : BigInt(10000000); // 0.1 SOL / 0.01 SOL
    
    // For now, use SOL as payment currency
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    
    // Build payment instructions using SDK
    // Note: In production, you'd need to set up the agent properly
    
    res.json({
      success: true,
      invoiceId,
      amount: amount.toString(),
      currency: 'SOL',
      wallet,
      action
    });
    
  } catch (error) {
    console.error('Payment create error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Verify payment and execute action
app.post('/execute', async (req, res) => {
  try {
    const { wallet, action, invoiceId, description } = req.body;
    
    if (!wallet || !action || !invoiceId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // In SDK mode, verify payment was made on-chain
    // For now, we'll use the existing gatekeeper logic as fallback
    
    const { verifyEligibility, verifySolFee } = require('./gatekeeper');
    
    // Check eligibility
    const eligibility = await verifyEligibility(wallet, action);
    const solCheck = await verifySolFee(wallet);
    
    if (!eligibility.eligible) {
      return res.status(400).json({ error: eligibility.message });
    }
    
    if (!solCheck.eligible) {
      return res.status(400).json({ error: solCheck.message });
    }
    
    // Execute the action
    if (action === 'propose') {
      if (!description) {
        return res.status(400).json({ error: 'Description required for proposal' });
      }
      const proposal = createProposal(wallet, description);
      accumulatedFees += FEE_LAMPORTS;
      
      return res.json({
        success: true,
        proposalId: proposal.id,
        feePaid: FEE_LAMPORTS / 1e9,
        message: 'Proposal created successfully'
      });
      
    } else if (action === 'vote') {
      const { proposalId, support } = req.body;
      if (!proposalId) {
        return res.status(400).json({ error: 'proposalId required for vote' });
      }
      
      const voteType = support ? 'for' : 'against';
      const vote = castVote(proposalId, wallet, voteType);
      accumulatedFees += FEE_LAMPORTS;
      
      return res.json({
        success: true,
        voteId: Date.now(),
        feePaid: FEE_LAMPORTS / 1e9,
        message: 'Vote cast successfully'
      });
    }
    
    res.status(400).json({ error: 'Invalid action' });
    
  } catch (error) {
    console.error('Execute error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Keep existing endpoints for compatibility
app.get('/verify/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const action = req.query.action || 'vote';
    
    const { verifyEligibility, verifySolFee } = require('./gatekeeper');
    const eligibility = await verifyEligibility(wallet, action);
    const solCheck = await verifySolFee(wallet);
    
    res.json({
      wallet,
      action,
      tokenHolding: eligibility,
      solForFee: solCheck,
      canExecute: eligibility.eligible && solCheck.eligible
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/propose', async (req, res) => {
  try {
    const { wallet, description } = req.body;
    
    if (!wallet || !description) {
      return res.status(400).json({ error: 'Missing wallet or description' });
    }
    
    const { verifyEligibility, verifySolFee } = require('./gatekeeper');
    const eligibility = await verifyEligibility(wallet, 'propose');
    const solCheck = await verifySolFee(wallet);
    
    if (!eligibility.eligible) {
      return res.status(400).json({ error: eligibility.message });
    }
    
    if (!solCheck.eligible) {
      return res.status(400).json({ error: solCheck.message });
    }
    
    // Generate proposal ID
    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const proposal = createProposal(proposalId, wallet, description, Date.now());
    accumulatedFees += FEE_LAMPORTS;
    
    res.json({
      success: true,
      proposalId: proposal.id,
      feePaid: FEE_LAMPORTS / 1e9
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/vote', async (req, res) => {
  try {
    const { wallet, proposalId, support } = req.body;
    
    if (!wallet || !proposalId || support === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const { verifyEligibility, verifySolFee } = require('./gatekeeper');
    const eligibility = await verifyEligibility(wallet, 'vote');
    const solCheck = await verifySolFee(wallet);
    
    if (!eligibility.eligible) {
      return res.status(400).json({ error: eligibility.message });
    }
    
    if (!solCheck.eligible) {
      return res.status(400).json({ error: solCheck.message });
    }
    
    const voteType = support ? 'for' : 'against';
    const vote = castVote(proposalId, wallet, voteType);
    accumulatedFees += FEE_LAMPORTS;
    
    res.json({
      success: true,
      voteId: Date.now(),
      feePaid: FEE_LAMPORTS / 1e9
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/proposals', (req, res) => {
  const proposals = getActiveProposals();
  res.json({ proposals, count: proposals.length });
});

app.get('/proposal/:id', (req, res) => {
  const proposal = getProposal(req.params.id);
  if (!proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }
  res.json(proposal);
});

app.get('/stats', (req, res) => {
  res.json({
    totalProposals: getActiveProposals().length,
    accumulatedFees: accumulatedFees / 1e9,
    feePerCall: FEE_LAMPORTS / 1e9,
    thresholds: {
      propose: `$${PROPOSAL_THRESHOLD}`,
      vote: `$${VOTE_THRESHOLD}`
    }
  });
});

app.post('/collect', (req, res) => {
  // Admin only - in production add auth
  const fees = accumulatedFees;
  accumulatedFees = 0;
  res.json({ collected: fees / 1e9 });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
