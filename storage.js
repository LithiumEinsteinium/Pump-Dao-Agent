/**
 * Simple JSON-file based storage for proposals and votes.
 * In production, replace with on-chain storage (Anchor program).
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'governance-db.json');

// Initialize or load database
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { proposals: [], votes: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

/**
 * Create a new proposal
 */
function createProposal(proposalId, creator, description, timestamp) {
  const db = loadDB();
  
  const proposal = {
    id: proposalId,
    creator,
    description,
    timestamp,
    status: 'active', // active, passed, rejected
    votesFor: 0,
    votesAgainst: 0,
    voters: [] // Track who voted to prevent double-voting
  };
  
  db.proposals.push(proposal);
  saveDB(db);
  return proposal;
}

/**
 * Cast a vote
 */
function castVote(proposalId, voter, voteType) {
  const db = loadDB();
  const proposal = db.proposals.find(p => p.id === proposalId);
  
  if (!proposal) {
    throw new Error('Proposal not found');
  }
  
  if (proposal.voters.includes(voter)) {
    throw new Error('User already voted');
  }
  
  if (voteType === 'for') {
    proposal.votesFor++;
  } else if (voteType === 'against') {
    proposal.votesAgainst++;
  }
  
  proposal.voters.push(voter);
  saveDB(db);
  
  return {
    votesFor: proposal.votesFor,
    votesAgainst: proposal.votesAgainst
  };
}

/**
 * Get proposal by ID
 */
function getProposal(proposalId) {
  const db = loadDB();
  return db.proposals.find(p => p.id === proposalId) || null;
}

/**
 * Get all active proposals
 */
function getActiveProposals() {
  const db = loadDB();
  return db.proposals.filter(p => p.status === 'active');
}

module.exports = {
  createProposal,
  castVote,
  getProposal,
  getActiveProposals,
  loadDB
};
