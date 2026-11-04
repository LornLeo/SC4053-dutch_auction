# DESIGN.md: Dutch Auction technical design

Detailed design behind `SPEC.md`: exact formulas, rounding, function flows, invariants. This is
the file given to AI coding tools alongside `SPEC.md`. Changes go through a PR and are noted in
`AI_AUDIT.md`.

## 1. Goal

Sell a fixed supply of an ERC20 token for ETH through a descending-price auction lasting
exactly 20 minutes. All winners pay the same uniform clearing price. Surplus ETH is
refunded. Unsold tokens are burned.

## 2. Decisions (agreed by the team)

| Topic | Decision |
|---|---|
| Refund of the threshold-crossing excess | Credited at `claim()`. `bid()` makes no external calls. |
| Repeat bids | Allowed. `bids[user]` accumulates. |
| Demo parameters | 1,000 tokens, start 1 ETH, reserve 0.1 ETH (per whole token) |
| Start trigger | Explicit `start()` call by the deployer; the 20-minute clock begins then |
| Bidders who never claim | `claimFor(address)` lets anyone settle a bidder; tokens and refund always go to the bidder (added after review, ISSUE-003) |
| Refund that cannot be delivered | Held in `pendingRefund` and withdrawn with `withdrawRefund(to)`; never blocks the tokens (added after review, ISSUE-004) |

## 3. Contracts

| Contract | Purpose |
|---|---|
| `AuctionToken.sol` | OpenZeppelin ERC20 + `ERC20Burnable`. Entire supply minted to the auction in its constructor. |
| `DutchAuction.sol` | Deploys the token, runs price decay, bidding, clearing, finalize, claims. Inherits `ReentrancyGuard`. |
| `ReentrancyAttacker.sol` | Bonus: malicious bidder that tries to re-enter `claim()`. |

Interface: `contracts/IDutchAuction.sol`.

## 4. Parameters (constructor)

| Name | Meaning | Demo value |
|---|---|---|
| `tokenSupply` | Tokens for sale, 18 decimals | 1,000e18 |
| `startPrice` | Wei per whole token (1e18 base units) at t = 0 | 1 ether |
| `reservePrice` | Price floor, wei per whole token | 0.1 ether |
| `DURATION` | Auction length (constant) | 20 minutes |

Constructor requires `startPrice > reservePrice > 0` and `tokenSupply > 0`. The deployer is
the `seller`.

## 5. Price function

Linear decay on `block.timestamp` (never block numbers):

```
before start()            -> auction not started
startTime <= t < endTime  -> startPrice - (startPrice - reservePrice) * (t - startTime) / DURATION
t >= endTime              -> reservePrice
```

Multiply before dividing. The price is non-increasing and never below `reservePrice`.

All amounts: tokens in base units (1e18 = 1 token), ETH in wei, price in wei per whole token.
`tokens = ethWei * 1e18 / price`.

## 6. Bidding and clearing

State: `totalCommitted` (accepted ETH), `bids[user]` (accepted ETH), `excess[user]` (ETH
owed back from the crossing bid), `soldOut` flag, `clearingPrice`.

**`bid()` (payable, nonReentrant)**
1. Revert `ZeroBid` if `msg.value == 0`.
2. Revert `AuctionNotStarted` before `start()`, `AuctionNotActive` if `t >= endTime` or
   `soldOut`.
3. Let `p = currentPrice()` and `maxCommit = tokenSupply * p / 1e18` (ETH needed to buy the
   whole supply at `p`).
4. **Guard for lazy clearing:** if `totalCommitted >= maxCommit`, demand already meets supply at
   the current price. Revert `AuctionNotActive`.
5. If `totalCommitted + msg.value < maxCommit`: accept it all. `bids[user] += msg.value`.
6. Otherwise (the **crossing bid**): `accepted = maxCommit - totalCommitted`.
   `bids[user] += accepted`, `excess[user] += msg.value - accepted`, `soldOut = true`,
   `clearingPrice = p`, emit `AuctionCleared`.
7. Update `totalCommitted`, emit `BidPlaced(bidder, accepted, refundable, p)`.

**Clearing price if the auction ended without a crossing bid** (computed in `finalize()`):

```
if soldOut:                     clearingPrice already set
else:                           clearingPrice = max(reservePrice, ceil(totalCommitted * 1e18 / tokenSupply))
```

- If `totalCommitted * 1e18 / tokenSupply` is below `reservePrice`, the auction did not sell
  out: price is the reserve and `tokensSold = totalCommitted * 1e18 / reservePrice`.
- If it is at or above the reserve, demand met supply at that price while the price was
  falling (between bids), so that is the clearing price. Round up so claims never exceed supply.

`tokensSold = min(tokenSupply, totalCommitted * 1e18 / clearingPrice)`.

## 7. Settlement

**`start()`**: seller only, once. Sets `startTime = block.timestamp`, `endTime = startTime + DURATION`.

**`finalize()`**: anyone, once, only when `soldOut` or `t >= endTime`. Sets `clearingPrice`
(see §6), computes `tokensSold`, burns `tokenSupply - tokensSold` via `burn`, sets
`finalized = true`, emits `AuctionFinalized(clearingPrice, tokensSold, tokensBurned)`.

**`claim()` / `claimFor(bidder)`** (nonReentrant, after `finalize()`). `claim()` settles `msg.sender`;
`claimFor(bidder)` lets anyone settle `bidder`. Tokens and refund always go to the bidder, never to the caller.
```
tokens = bids[bidder] * 1e18 / clearingPrice                // rounds down
cost   = tokens * clearingPrice / 1e18                      // rounds down
refund = (bids[bidder] - cost) + excess[bidder]
bids[bidder] = 0; excess[bidder] = 0                        // effects BEFORE interactions
proceeds += cost
token.transfer(bidder, tokens)
send refund with call{value: refund}("")
  if the send fails: pendingRefund[bidder] += refund; emit RefundDeferred   // never reverts the claim
```
Revert `NothingToClaim` if the bidder has no bid and no excess. Emit `Claimed(bidder, tokens, refundPaid)`.

**`withdrawRefund(to)`**: a bidder with a `pendingRefund` withdraws it to any non-zero address `to` (so a
contract wallet that cannot receive ETH can redirect it). Zeroes the balance before sending.

**`withdrawProceeds()`**: seller only, after `finalize()`. Pays out `proceeds` (accrued in
`claim()`) and zeroes it before sending. Accruing at claim time keeps the contract solvent
despite rounding: `cost + refund == bids + excess` for every user, so no wei is created or lost.

**Burn:** unsold tokens are burned in `finalize()`. Per-user rounding dust (at most a few base
units) stays unclaimed in the contract and is accepted.

Refunds are pull-based, not automatic push payments, so one failing recipient cannot block the
auction (reasoning also in `SPEC.md` key decisions).

## 8. Interface summary

Functions: `start`, `bid`, `finalize`, `claim`, `claimFor`, `withdrawRefund`, `withdrawProceeds`, views
`currentPrice`, `timeRemaining`, `totalCommitted`, `bids`, `pendingRefund`, `clearingPrice`, `tokensFor`,
`refundFor`, `startTime`, `endTime`, `startPrice`, `reservePrice`, `tokenSupply`, `finalized`.
Events: `AuctionStarted`, `BidPlaced`, `AuctionCleared`, `AuctionFinalized`, `Claimed`,
`ProceedsWithdrawn`, `RefundDeferred`, `RefundWithdrawn`. All are in `contracts/IDutchAuction.sol`.

## 9. Security requirements

- `ReentrancyGuard` on `bid`, `claim`, `claimFor`, `withdrawRefund`, `withdrawProceeds`
- Checks-effects-interactions: zero balances before any transfer
- ETH sent with `call`, return value checked, custom error on failure
- Solidity 0.8.x; document every rounding direction
- Seller can never touch bidder ETH except accrued `proceeds`
- `claimFor` only ever pays the bidder, so a third party cannot redirect funds
- Custom errors; an event for every state change
- Invariants: contract ETH >= everything owed; total tokens claimed <= `tokensSold` <= supply

## 10. Frontend (React + ethers + MetaMask, local Hardhat node)

Summary only. The full frontend spec (statuses, enable rules, chain time, formulas, acceptance tests) is
`FRONTEND_SPEC.md`.

- Connect wallet; show network, account, ETH balance
- Status: Not started / Active / Sold out / Ended / Finalized
- Live price and countdown (from `startTime` and chain time)
- Total committed, tokens remaining at current price
- Bid form with estimated tokens at current price and a warning that the final price is the
  clearing price, not the bid-time price
- After finalize: tokens and refund preview, Claim button
- Finalize button (anyone), Start and Withdraw buttons visible to the seller only
- Show transaction status and decoded errors

## 11. Test checklist

1. Price at t = 0, 10 min, 20 min, after end; never below reserve
2. `bid` before `start` and after end reverts; `start` twice reverts; non-seller `start` reverts
3. Single bid that sells out the whole supply (crossing bid, refund via claim)
4. Several bids, last one crosses the threshold (partial fill, `excess` credited)
5. Never sells out: clearingPrice == reserve, unsold tokens burned, supply decreases
6. Lazy clear: demand meets supply between bids, then `finalize` uses `ceil(committed / supply)`
7. Claim maths: `cost + refund == bids + excess`; total claimed tokens <= `tokensSold`
8. Double claim and claim before finalize revert
9. Reentrancy attacker on `claim` and `withdrawProceeds` cannot drain funds
10. `finalize` once only; callable by anyone; blocked before the end unless sold out
11. Rounding edge cases: 1 wei bids, bids that don't divide evenly by price
12. Fuzz/invariant: random bid sequences never leave the contract insolvent or over-issue tokens
13. `withdrawProceeds` is seller-only and pays exactly the accrued amount
14. `claimFor`: a third party settles a bidder who never claims; tokens and refund reach the bidder; seller can then withdraw everything
15. A contract bidder that cannot receive ETH still gets its tokens; refund held in `pendingRefund` and recoverable with `withdrawRefund(to)`
16. `withdrawRefund` rejects the zero address and callers with nothing pending; final contract balance is 0 after everyone settles

## 12. Out of scope

Whitelists, multiple auctions, upgradeability, mainnet deployment, off-chain order books.

## 13. Demo plan (for the video)

1. Deploy locally, show token and auction addresses
2. `start()`, show the price falling on the UI
3. Three accounts bid at different prices; show committed total rising
4. Crossing bid triggers sell-out; show clearing price
5. `finalize()`, then each account claims; show tokens, refunds and the burn
6. Run the reentrancy attacker test and show it failing to drain funds
