# FRONTEND_SPEC.md: Dutch Auction web app

The frontend spec, written before any frontend code was generated (prompt F0 in `audit/frontend-prompts.md`). It
expands `DESIGN.md` §10. The contracts (`contracts/`) are fixed: the frontend adapts to them, never the other way round.

> **Provenance:** drafted by Claude (Claude Code) from `SPEC.md`, `DESIGN.md` and the contracts. The open decisions in
> §11 were taken by the AI using its own recommendations, because C asked for the frontend to be completed end to end.
> C must confirm or change each one; see `AI_AUDIT.md` §1.

## 1. Stack

| Item | Choice | Why |
|---|---|---|
| Build tool | Vite 5 (pinned) | Fast dev server, simple config, a proxy for the local RPC |
| UI | React 18.3 (JavaScript, no TypeScript) | Matches the team's JS Hardhat setup; nothing new to learn |
| Chain library | ethers v6 (pinned) | Same library as the Hardhat tests; native `BigInt` |
| Wallet | MetaMask (EIP-1193 `window.ethereum`) | Required by `DESIGN.md` §10 |
| Tests | Vitest | Same config as Vite; runs the pure maths in Node |
| Styling | Plain CSS with custom properties | No UI-library dependency |

Pin exact versions in `frontend/package.json` (no `^`), the lesson from ISSUE-005.

## 2. Network and contract wiring

- Target chain: Hardhat local node, chain id **31337**, RPC `http://127.0.0.1:8545`.
- `scripts/deploy.js` and `scripts/seed.js` write `frontend/src/contracts.json` after deploying:
  `{ chainId, deployBlock, auction: { address, abi }, token: { address, abi } }`. The ABIs come from `artifacts/`
  (the full `DutchAuction` ABI, not `IDutchAuction`, because the UI needs `seller`, `soldOut`, `excess`,
  `tokensSold`, `proceeds`, `token`).
- **Reads** go through a read-only `JsonRpcProvider` to the local node (proxied by Vite at `/rpc`), so the page works
  before a wallet is connected. **Writes** go through the connected signer.
- On load, check there is code at the auction address. If not, show "Contract not deployed on this chain, run the
  deploy script".

## 3. Wallets

1. **MetaMask:** connect with `eth_requestAccounts`. Show the shortened account, chain id, ETH balance and AUC
   balance. If the chain id is not 31337, show a banner with a "Switch to Hardhat Local" button
   (`wallet_switchEthereumChain`, falling back to `wallet_addEthereumChain`). React to `accountsChanged` and
   `chainChanged` without a reload, and remove the listeners on unmount.
2. **Local test account (development only):** a dropdown of the node's unlocked accounts (`eth_accounts`), signing
   through the node's own `eth_sendTransaction`. This lets the demo switch between seller and bidders quickly, and
   lets the UI be tested without MetaMask. It is shown only when the RPC chain id is 31337, and labelled
   "local test account". No private key ever reaches the frontend.

## 4. Auction status

`now` is **chain time** (see §6). `maxCommit(now) = tokenSupply * price(now) / 1e18`.

| Status | Condition (checked in this order) | Meaning |
|---|---|---|
| Not started | `startTime == 0` | Waiting for the seller's `start()` |
| Finalized | `finalized` | Clearing price fixed, claims open |
| Sold out | `soldOut` | A crossing bid cleared the auction; `finalize()` is open |
| Ended | `now >= endTime` | 20 minutes are up; `finalize()` is open |
| Demand met | `totalCommitted >= maxCommit(now)` | The price fell until demand covers supply. `bid()` reverts (`AuctionNotActive`) and `finalize()` still reverts until `endTime` (`AuctionNotEnded`) |
| Active | otherwise | Bidding open |

## 5. Actions and when they are enabled

| Action | Who sees it | Enabled when | Contract reverts with |
|---|---|---|---|
| `start()` | seller only | Not started | `NotSeller`, `AlreadyStarted` |
| `bid()` | anyone connected | Active, amount > 0 | `ZeroBid`, `AuctionNotStarted`, `AuctionNotActive` |
| `finalize()` | anyone connected | Sold out or Ended | `AuctionNotStarted`, `AuctionAlreadyFinalized`, `AuctionNotEnded` |
| `claim()` | anyone connected | Finalized and (`bids[me] > 0` or `excess[me] > 0`) | `AuctionNotFinalized`, `NothingToClaim` |
| `claimFor(addr)` | anyone connected | Finalized, valid address that has something to claim | same as `claim()` |
| `withdrawRefund(to)` | the bidder | `pendingRefund[me] > 0`, `to` a valid non-zero address | `InvalidParams`, `NothingToClaim`, `TransferFailed` |
| `withdrawProceeds()` | seller only | Finalized and `proceeds > 0` | `NotSeller`, `AuctionNotFinalized` |

Hiding seller buttons is a UX choice only; the contract enforces access (`NotSeller`). Addresses are compared case-insensitively.

## 6. Time

- The contract uses `block.timestamp`. A Hardhat node gives each new block the wall-clock time (plus any
  `evm_increaseTime` offset), and only when a block is mined.
- The UI anchors on the latest block: `chainNow = latestBlock.timestamp + secondsSince(localTimeWhenFetched)`,
  re-anchored on every refresh. It never uses `Date.now()` alone as the auction clock.
- The countdown is `max(0, endTime - chainNow)`. The price shown is `price(chainNow)` computed with the contract
  formula, and the refresh reconciles it with `currentPrice()`.

## 7. Units and formulas (must match the contract exactly)

All values are `BigInt`. ETH is in wei, tokens in base units (1e18 = 1 token), prices in wei per whole token.
Format for display only, with `formatEther` / `formatUnits`; parse input with `parseEther`. Never use a JS `Number` for wei.

```
price(t)        = t >= endTime ? reservePrice : startPrice - (startPrice - reservePrice) * (t - startTime) / 1200
maxCommit       = tokenSupply * price / 1e18
remainingEth    = max(0, maxCommit - totalCommitted)
tokensRemaining = remainingEth * 1e18 / price
bid estimate    : accepted = min(amount, remainingEth); refundable = amount - accepted
                  tokensAtCurrentPrice = accepted * 1e18 / price          (estimate only)
after finalize  : tokensFor(me), refundFor(me) read from the contract
tokensBurned    = tokenSupply - tokensSold
```

## 8. Screens and components

One page:
1. **Header:** title, wallet connect, account, chain, ETH and AUC balances, network warning.
2. **Hero:** status badge, current price, countdown, a price-decay chart (inline SVG) with a "now" marker.
3. **Progress:** committed against `maxCommit`, tokens remaining, a progress bar.
4. **Bid form:** ETH amount; estimated tokens; warning "every winner pays the final clearing price, which is at or
   below today's price"; partial-fill warning when the amount is over `remainingEth`.
5. **My position:** committed ETH, crossing-bid surplus (`excess`); after finalize, tokens, refund, pending refund,
   Claim and Withdraw-refund buttons.
6. **Settlement:** Finalize button (anyone), "Settle another bidder" (`claimFor`).
7. **Results** (after finalize): clearing price, tokens sold, tokens burned, token `totalSupply`, proceeds waiting.
8. **Seller panel** (seller only): Start, Withdraw proceeds, Settle all bidders (from `BidPlaced` events, `claimFor`
   one at a time with progress).
9. **Activity feed:** `AuctionStarted`, `BidPlaced`, `AuctionCleared`, `AuctionFinalized`, `Claimed`,
   `RefundDeferred`, `RefundWithdrawn`, `ProceedsWithdrawn`, newest first.

## 9. Transaction feedback and errors

- One helper wraps every write: *confirm in wallet*, then *pending (tx hash)*, then *confirmed (block)*, or *failed*.
- Custom errors are decoded with the `DutchAuction` ABI and shown in plain English (a table in `src/lib/errors.js`).
- A rejection in the wallet (`ACTION_REJECTED` / code 4001) is shown as "cancelled", not as an error.
- A button is disabled while its transaction is pending, to prevent double submits. All data refreshes after confirmation.

## 10. Acceptance criteria (manual test)

1. Page loads without a wallet and shows live auction data.
2. Wrong network shows the banner; switching fixes it without a reload.
3. Before `start()`: status Not started, bidding disabled, Start visible to the seller only.
4. After `start()`: the price falls by 0.00075 ETH per second and the countdown runs; the UI price matches `currentPrice()`
   to within one second of decay.
5. A bid updates committed and remaining; the crossing bid shows the partial-fill warning and makes the status Sold out.
6. Finalize from a non-seller works; results show clearing price, sold, burned, and the token supply drops.
7. Claim shows exactly `tokensFor` / `refundFor` beforehand and the balances change by those amounts.
8. `claimFor` settles another bidder; the seller withdraws proceeds; contract ETH ends at 0 once all are settled.
9. Time expiry without sell-out: reserve price, unsold tokens burned.
10. Reverts show decoded messages; a rejected signature shows "cancelled".

## 11. Decisions (taken by the AI on its recommendation; C to confirm)

| Question | Options | Decision |
|---|---|---|
| JS or TypeScript | JS / TS | JS, to match the Hardhat project |
| Read path | MetaMask provider / direct RPC | Direct RPC for reads (works with no wallet), signer for writes |
| Refresh | Events / polling | Poll every 2 s (local node, cheap), plus an immediate refresh after each tx |
| Test accounts without MetaMask | Allow / forbid | Allow on chain 31337 only, using the node's unlocked accounts |
| Chart | Library / inline SVG | Inline SVG, no dependency |
| Where `contracts.json` lives | Committed / generated only | Committed: a fresh node always deploys to the same address, so a fresh clone works |
