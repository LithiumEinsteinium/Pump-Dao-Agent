/**
 * Governance Agent - Headless API Server
 * Provides governance services for Pump.fun tokenized communities.
 * 
 * Endpoints:
 * - POST /propose: Submit a proposal (requires $100 holdings)
 * - POST /vote: Cast a vote (requires $10 holdings)
 * - GET /proposals: List all proposals
 * - GET /proposal/:id: Get specific proposal
 * - GET /verify/:wallet: Check eligibility
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { verifyEligibility } = require('./gatekeeper');
const { createProposal, castVote, getProposal, getActiveProposals } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

console.log('🏛️  $PDA - Pump DAO Agent Starting... (Build v2 - USDC Hardcoded)');
console.log(`   Ticker: $PDA`);
console.log(`   Thresholds: $${process.env.PROPOSAL_THRESHOLD_USD} to propose, $${process.env.VOTE_THRESHOLD_USD} to vote`);
console.log(`   Agent Token: ${process.env.AGENT_TOKEN_MINT_ADDRESS}`);
console.log('─'.repeat(60));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Check eligibility for a wallet
app.get('/verify/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const action = req.query.action || 'vote'; // 'propose' or 'vote'
    
    const result = await verifyEligibility(wallet, action);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit a proposal
app.post('/propose', async (req, res) => {
  try {
    const { wallet, description } = req.body;
    
    if (!wallet || !description) {
      return res.status(400).json({ error: 'Missing wallet or description' });
    }
    
    // 1. Verify eligibility ($100 threshold)
    const eligibility = await verifyEligibility(wallet, 'propose');
    
    if (!eligibility.eligible) {
      return res.status(403).json({ 
        error: 'Insufficient holdings', 
        details: eligibility.message 
      });
    }
    
    // 2. Create proposal
    const proposalId = `prop-${Date.now()}`;
    const proposal = createProposal(
      proposalId,
      wallet,
      description,
      new Date().toISOString()
    );
    
    console.log(`✅ Proposal created: ${proposalId} by ${wallet}`);
    
    res.json({
      success: true,
      proposalId,
      message: 'Proposal submitted successfully',
      eligibility: eligibility.message
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cast a vote
app.post('/vote', async (req, res) => {
  try {
    const { wallet, proposalId, vote } = req.body; // vote: 'for' or 'against'
    
    if (!wallet || !proposalId || !vote) {
      return res.status(400).json({ error: 'Missing wallet, proposalId, or vote' });
    }
    
    if (!['for', 'against'].includes(vote)) {
      return res.status(400).json({ error: 'Vote must be "for" or "against"' });
    }
    
    // 1. Verify eligibility ($10 threshold)
    const eligibility = await verifyEligibility(wallet, 'vote');
    
    if (!eligibility.eligible) {
      return res.status(403).json({ 
        error: 'Insufficient holdings', 
        details: eligibility.message 
      });
    }
    
    // 2. Cast vote
    const result = castVote(proposalId, wallet, vote);
    
    console.log(`✅ Vote cast: ${wallet} voted ${vote} on ${proposalId}`);
    
    res.json({
      success: true,
      proposalId,
      votesFor: result.votesFor,
      votesAgainst: result.votesAgainst,
      eligibility: eligibility.message
    });
  } catch (error) {
    console.error('Error casting vote:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all proposals
app.get('/proposals', (req, res) => {
  try {
    const proposals = getActiveProposals();
    res.json({ proposals, count: proposals.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific proposal
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

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`   - GET  /health`);
  console.log(`   - GET  /verify/:wallet?action=propose|vote`);
  console.log(`   - POST /propose`);
  console.log(`   - POST /vote`);
  console.log(`   - GET  /proposals`);
  console.log(`   - GET  /proposal/:id`);
});
