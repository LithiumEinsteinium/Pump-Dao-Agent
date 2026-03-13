# 🏛️ $PDA - Pump DAO Agent

**Ticker:** $PDA  
**Mission:** Decentralized Governance for Pump.fun Communities

A **headless governance API** for tokenized communities on Pump.fun. This agent enables decentralized proposal and voting systems where participation is gated by **real-time token holdings value**.

## 🌟 Features

- **Dynamic Thresholds**: Users must hold **$100** worth of tokens to propose, **$10** to vote (configurable).
- **Real-Time Valuation**: Uses Jupiter Price API to calculate USD value of holdings instantly.
- **No Execution Risk**: Agent only records governance actions; it never executes swaps or moves funds.
- **Headless Design**: Pure REST API - integrate with any frontend (web, mobile, Discord, Telegram).
- **Pump.fun Ready**: Built specifically for Pump.fun Tokenized Agents.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd pump-dao-agent  # or your folder name
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

**Required Variables:**
- `AGENT_TOKEN_MINT_ADDRESS`: Your Pump.fun token mint address
- `PROPOSAL_THRESHOLD_USD`: Minimum USD value to propose (default: 100)
- `VOTE_THRESHOLD_USD`: Minimum USD value to vote (default: 10)
- `SOLANA_RPC_URL`: Your Solana RPC endpoint

### 3. Run the Agent

```bash
npm start
```

Server runs on `http://localhost:3000` by default.

## 📡 API Endpoints

### Check Eligibility
```bash
GET /verify/:wallet?action=propose|vote
```
Returns whether the wallet meets the holding threshold.

### Submit Proposal
```bash
POST /propose
Body: { "wallet": "...", "description": "Burn 5% of supply" }
```
Creates a new proposal if user holds ≥ $100.

### Cast Vote
```bash
POST /vote
Body: { "wallet": "...", "proposalId": "prop-123", "vote": "for" }
```
Records a vote if user holds ≥ $10.

### List Proposals
```bash
GET /proposals
```
Returns all active proposals.

### Get Proposal Details
```bash
GET /proposal/:id
```

## 🧠 How It Works

1. **User Action**: Community member wants to propose or vote.
2. **Eligibility Check**: Agent fetches real-time token price (Jupiter) + user balance (Solana RPC).
3. **Threshold Validation**: Calculates `holdings * price` and compares to thresholds.
4. **Record Action**: If eligible, proposal/vote is recorded in local storage (upgradeable to on-chain).
5. **Community Review**: Proposals are visible via API for community to review.
6. **Manual Execution**: Once a proposal passes (e.g., majority vote), the community manually executes the action.

## 🔒 Security Notes

- **No Private Keys**: Agent never holds or signs with private keys.
- **Read-Only**: Only reads balances and records votes; cannot move funds.
- **Server-Side Verification**: All eligibility checks happen server-side.
- **Upgrade Path**: Currently uses JSON file storage; migrate to Anchor program for production.

## 🛠️ Integration Example

```javascript
// Check if user can propose
const eligibility = await fetch('http://localhost:3000/verify/WALLET_ADDRESS?action=propose');
const data = await eligibility.json();

if (data.eligible) {
  // Submit proposal
  const proposal = await fetch('http://localhost:3000/propose', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet: 'WALLET_ADDRESS',
      description: 'Use treasury to buy a banner ad'
    })
  });
}
```

## 📦 Next Steps (Production)

1. **Deploy**: Host on Render, Railway, or VPS.
2. **On-Chain Storage**: Replace `storage.js` with an Anchor program.
3. **Frontend**: Build a simple UI for communities to interact.
4. **Notifications**: Add webhooks/Discord alerts for new proposals.

---

**Built for the Solana AI Agent ecosystem** 🌊🤖
