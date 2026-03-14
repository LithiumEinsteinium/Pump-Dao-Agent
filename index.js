/**
 * Governance Agent - Headless API Server
 * Provides governance services for Pump.fun tokenized communities.
 * 
 * Endpoints:
 * - POST /propose: Submit a proposal (requires $100 PDA holdings + 0.0025 SOL fee)
 * - POST /vote: Cast a vote (requires $10 PDA holdings + 0.0025 SOL fee)
 * - GET /proposals: List all proposals
 * - GET /proposal/:id: Get specific proposal
 * - GET /verify/:wallet: Check eligibility
 * - POST /collect: Collect accumulated SOL fees
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { verifyEligibility, verifySolFee } = require('./gatekeeper');
const { createProposal, castVote, getProposal, getActiveProposals } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

// Accumulated fees (in production, store in database)
let accumulatedFees = 0;

app.use(cors());
app.use(express.json());

console.log('🏛️  $PDA - Pump DAO Agent Starting... (Build v3 - SOL Fee)');
console.log(`   Ticker: $PDA`);
console.log(`   Thresholds: $${process.env.PROPOSAL_THRESHOLD_USD} to propose, $${process.env.VOTE_THRESHOLD_USD} to vote`);
console.log(`   API Fee: 0.0025 SOL per call`);
console.log(`   Agent Token: ${process.env.AGENT_TOKEN_MINT_ADDRESS || 'NOT SET'}`);
console.log('─'.repeat(60));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    accumulatedFees: accumulatedFees / 1e9
  });
});

// Check eligibility for a wallet (no fee needed)
app.get('/verify/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const action = req.query.action || 'vote';
    
    // Check token holdings
    const eligibility = await verifyEligibility(wallet, action);
    
    // Check SOL balance for fee
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

// Submit a proposal - costs 0.0025 SOL
app.post('/propose', async (req, res) => {
  try {
    const { wallet, description } = req.body;
    
    if (!wallet || !description) {
      return res.status(400).json({ error: 'Missing wallet or description' });
    }
    
    // 1. Verify token holdings ($100 threshold)
    const eligibility = await verifyEligibility(wallet, 'propose');
    
    if (!eligibility.eligible) {
      return res.status(403).json({ 
        error: 'Insufficient $PDA holdings', 
        details: eligibility.message 
      });
    }
    
    // 2. Verify SOL for fee
    const solCheck = await verifySolFee(wallet);
    
    if (!solCheck.eligible) {
      return res.status(403).json({ 
        error: 'Insufficient SOL for fee', 
        details: solCheck.message 
      });
    }
    
    // 3. Collect fee (in production, this would be an on-chain transfer)
    accumulatedFees += 2500000; // 0.0025 SOL
    
    // 4. Create proposal
    const proposalId = `prop-${Date.now()}`;
    const proposal = createProposal(
      proposalId,
      wallet,
      description,
      new Date().toISOString()
    );
    
    console.log(`✅ Proposal created: ${proposalId} by ${wallet} (fee: 0.0025 SOL)`);
    
    res.json({
      success: true,
      proposalId,
      message: 'Proposal submitted successfully',
      feePaid: '0.0025 SOL',
      totalFeesCollected: accumulatedFees / 1e9,
      eligibility: eligibility.message
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cast a vote - costs 0.0025 SOL
app.post('/vote', async (req, res) => {
  try {
    const { wallet, proposalId, vote } = req.body;
    
    if (!wallet || !proposalId || !vote) {
      return res.status(400).json({ error: 'Missing wallet, proposalId, or vote' });
    }
    
    if (!['for', 'against'].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be "for" or "against"' });
    }
    
    // 1. Verify token holdings ($10 threshold)
    const eligibility = await verifyEligibility(wallet, 'vote');
    
    if (!eligibility.eligible) {
      return res.status(403).json({ 
        error: 'Insufficient $PDA holdings', 
        details: eligibility.message 
      });
    }
    
    // 2. Verify SOL for fee
    const solCheck = await verifySolFee(wallet);
    
    if (!solCheck.eligible) {
      return res.status(403).json({ 
        error: 'Insufficient SOL for fee', 
        details: solCheck.message 
      });
    }
    
    // 3. Collect fee
    accumulatedFees += 2500000;
    
    // 4. Cast vote
    const result = castVote(proposalId, wallet, vote);
    
    console.log(`✅ Vote cast: ${wallet} voted ${vote} on ${proposalId} (fee: 0.0025 SOL)`);
    
    res.json({
      success: true,
      proposalId,
      vote,
      feePaid: '0.0025 SOL',
      totalFeesCollected: accumulatedFees / 1e9,
      votesFor: result.votesFor,
      votesAgainst: result.votesAgainst
    });
  } catch (error) {
    console.error('Error casting vote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all proposals (free)
app.get('/proposals', (req, res) => {
  try {
    const proposals = getActiveProposals();
    res.json({ proposals, count: proposals.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific proposal (free)
app.get('/proposal/:id', (req, res) => {
  try {
    const proposal = getProposal(req.params.id);
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    res.json(proposal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Collect accumulated fees (admin only - in production, verify admin)
app.post('/collect', (req, res) => {
  try {
    const { adminWallet } = req.body;
    
    if (!adminWallet) {
      return res.status(400).json({ error: 'Missing admin wallet' });
    }
    
    // In production, this would transfer SOL to the admin wallet
    const fees = accumulatedFees;
    accumulatedFees = 0;
    
    console.log(`💰 Fees collected: ${fees / 1e9} SOL by ${adminWallet}`);
    
    res.json({
      success: true,
      collected: fees / 1e9,
      message: 'Fees collected successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stats endpoint (free)
app.get('/stats', (req, res) => {
  res.json({
    totalProposals: getActiveProposals().length,
    accumulatedFees: accumulatedFees / 1e9,
    feePerCall: 0.0025,
    thresholds: {
      propose: `$${process.env.PROPOSAL_THRESHOLD_USD || 100}`,
      vote: `$${process.env.VOTE_THRESHOLD_USD || 10}`
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏛️  Pump DAO Agent running on port ${PORT}`);
  console.log(`📊 Stats: /stats | Proposals: /proposals`);
});

module.exports = app;
