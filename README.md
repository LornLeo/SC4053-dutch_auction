# AUC Dutch Auction: SC4053 Development Project (Option 2)

A token launch where 1,000 **AUC** (ERC20) tokens are sold for ETH in a **20-minute descending-price (Dutch)
auction**. The price falls linearly from 1 ETH to 0.1 ETH per token. Every winner pays the same clearing price,
surplus ETH is refunded, and unsold tokens are burned. It comes with a React web app and an AI audit report.

| Document | What it is |
|---|---|
| [`SPEC.md`](SPEC.md) | Requirements: what and why |
| [`DESIGN.md`](DESIGN.md) | Contract design: formulas, flows, test checklist |
| [`FRONTEND_SPEC.md`](FRONTEND_SPEC.md) | Frontend design: statuses, enable rules, chain time, units |
| [`AI_AUDIT.md`](AI_AUDIT.md) | AI Audit Report (course brief §2) |
| [`audit/`](audit/) | Evidence: AI first draft, test outputs, E2E notes, prompt chain |

## Repository layout

```
contracts/      DutchAuction.sol, AuctionToken.sol, IDutchAuction.sol, ReentrancyAttacker.sol, mocks/
scripts/        deploy.js, seed.js, exportFrontend.js (writes frontend/src/contracts.json)
test/           contract tests (smoke, Part A review) + FrontendParity.test.js
frontend/       React + Vite + ethers v6 web app
  src/lib/        auctionMath.js (UI maths = contract maths), chainClock.js, errors.js, format.js, contract.js
  src/hooks/      useAuction.js (on-chain state, polling, chain time)
  src/context/    WalletContext.jsx (MetaMask / local test accounts), TxContext.jsx (tx status)
  src/components/ Header, PriceHero (chart), BidPanel, Settlement, SellerPanel, ActivityFeed, Toasts
audit/          evidence for AI_AUDIT.md
```

## Prerequisites

- **Node.js 20 or newer** (tested with 24.14) and npm
- **MetaMask** browser extension (optional for local testing, see "Without MetaMask" below)
- Windows, macOS or Linux. Commands are given for PowerShell and for bash where they differ.

## Install and test

```bash
npm install
cd frontend && npm install && cd ..
```

```bash
npx hardhat test
```

```bash
cd frontend && npm test
```

`npx hardhat test` runs the contract suites and `test/FrontendParity.test.js`, which runs the frontend's maths
against the deployed contract. `npm test` in `frontend/` runs the Vitest unit tests.

## Run the dApp locally

Use three terminals.

**1. Local chain** (chain id 31337, RPC `http://127.0.0.1:8545`; it prints 20 funded test accounts):
```bash
npx hardhat node
```

**2. Deploy**, which also writes `frontend/src/contracts.json` with the addresses and ABIs:
```bash
npx hardhat run scripts/deploy.js --network localhost
```
**Using MetaMask?** Use this instead. It deploys and then runs `scripts/sync-nonces.js`, which prevents MetaMask's
"Nonce too high" error after a node restart (see Troubleshooting):
```bash
npm run deploy:local
```
Or deploy, start and place three demo bids in one go (the last one sells out the auction):
```bash
npx hardhat run scripts/seed.js --network localhost
```

**3. Web app:**
```bash
cd frontend && npm run dev
```
Open http://localhost:5173.

### Connect MetaMask

1. In MetaMask, add a network: name `Hardhat Local`, RPC `http://127.0.0.1:8545`, chain id `31337`, symbol `ETH`.
   The app also offers a **Switch to Hardhat Local** button when MetaMask is on another network.
2. Import a few of the private keys printed by `npx hardhat node`. Account #0 is the deployer and **seller**;
   use #1 to #3 as bidders. These are public test keys: never send real funds to them.
3. Click **Connect MetaMask**.

### Without MetaMask

On chain 31337 the header shows **Use local test account…**, a list of the node's unlocked accounts. The app then
signs through the local node, so you can switch between seller and bidders in one click during a demo. No private
key is handled by the frontend.

## Demo walkthrough (DESIGN.md §13)

1. Deploy with `deploy.js`. The footer shows the auction and token addresses.
2. As **#0 (seller)**, click **Start auction**. The price starts falling and the countdown runs.
3. As **#1, #2, #3**, place bids (e.g. 300, 250, then 600 ETH). Watch "Committed" rise. On the last bid the form
   warns that only part is accepted and the rest is refunded at claim.
4. The status becomes **Sold out** and the hero shows the **clearing price**.
5. Any account clicks **Finalize auction**. Results show tokens sold, burned and the new total supply.
6. Each bidder clicks **Claim**: the button shows exactly the tokens and refund the contract will pay. Or use
   **Settle another bidder** / the seller's **Settle all bidders** (`claimFor`).
7. The seller clicks **Withdraw proceeds**. "ETH held by contract" ends at 0.
8. Bonus: `npx hardhat test` shows `reentrancy attacker cannot claim twice` passing.

### Fast-forward time

To skip the 20 minutes (e.g. to show a never-sold-out auction with a burn):
```bash
npx hardhat console --network localhost
```
```
await network.provider.send("evm_increaseTime", [1200]); await network.provider.send("evm_mine")
```
The UI follows chain time (the node's pending-block timestamp), so it jumps forward too.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Cannot reach the local Hardhat node" | Start `npx hardhat node` (terminal 1) |
| "No contract at 0x… on this chain" | The node was restarted: run the deploy script again |
| MetaMask "Nonce too high. Expected nonce to be X but got Y" after a node restart | Run `npm run sync-nonces` (or deploy with `npm run deploy:local`). A restarted node resets every account's nonce to 0, but MetaMask remembers the old count and uses whichever number is higher. The script raises the test accounts' nonces on the **local node only** above anything MetaMask remembers. Clearing MetaMask's activity data alone often isn't enough, because some versions keep the nonce in memory until the extension restarts |
| Banner "MetaMask is on chain …" | Click **Switch to Hardhat Local** |
| Old addresses after redeploying | `contracts.json` is rewritten by the deploy script; the dev server reloads it. A fresh node always deploys to `0x5FbDB2315678afecb367f032d93F642f64180aa3` |
| Hardhat errors about Hardhat 3 / `forge-std` / `ts-node` | This project uses **Hardhat 2** (see ISSUE-005 in `AI_AUDIT.md`); run `npm install` in the repo root, not `npx hardhat init` |

## Team

| Role | Member | Owns |
|---|---|---|
| A | `<name>` | Contracts, deployment, demo scripts |
| B | `<name>` | Tests, security, validation |
| C | `<name>` | Frontend, README, demo video, AI audit assembly |
