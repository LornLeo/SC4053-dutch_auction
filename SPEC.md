# SPEC.md: Dutch Auction Token Launch (SC4053, Option 2)

What we are building and why. Technical detail is in `DESIGN.md`. Written before any
AI-generated contract code; AI assistance in drafting it is recorded in
`AI_AUDIT.md` §3.3 (P0).

## 1. Goal
A token launch where an ERC20 token is sold for ETH through a descending-price (Dutch)
auction lasting exactly 20 minutes. Every winner pays the same clearing price, surplus ETH is
refunded, and unsold tokens are burned.

## 2. Problem it solves
Fixed-price sales cause gas wars, mis-priced tokens and bot front-running. A descending
price with a uniform clearing price lets the market find the price and treats all bidders
equally.

## 3. Actors
- **Seller:** deploys, starts the auction, withdraws the proceeds
- **Bidder:** commits ETH, then claims tokens and any refund
- **Anyone:** can finalize the auction once it has ended or sold out, and can settle any bidder's claim for them

## 4. Core behaviour
- The price starts high and falls linearly to a reserve price over 20 minutes
- Bidders commit ETH at any time while the auction is active; they may bid more than once
- The auction ends when demand meets the token supply (sold out) or the 20 minutes elapse
- All winners pay one uniform clearing price, whatever they bid
- If the auction never sells out, the price is the reserve and unsold tokens are burned
- A bid that crosses the sell-out point is only partly accepted; the rest is refundable
- After finalizing, each bidder claims their tokens and a refund of any surplus ETH
- A bidder who never claims can be settled by anyone, so they cannot lock the seller's proceeds
- A refund that cannot be delivered is held for the bidder to withdraw and never blocks their tokens
- The seller receives the proceeds

## 5. Key decisions
| Topic | Decision |
|---|---|
| Surplus ETH from the crossing bid | Refunded at claim, not during the bid |
| Repeat bids | Allowed, they accumulate |
| Demo parameters | 1,000 tokens, price 1 ETH down to 0.1 ETH per token |
| Start | Seller calls `start()`; the clock begins then |
| Refunds | Pull-based, so one failing recipient cannot block others |
| Non-claiming bidders | Anyone can call `claimFor(bidder)`; funds always go to the bidder |
| Undeliverable refunds | Held in `pendingRefund`, withdrawn with `withdrawRefund(to)` |

## 6. Features
**Contracts:** ERC20 token, auction engine, reentrancy attacker (bonus demo).
**Frontend:** connect wallet, live price and countdown, bid form, claim and refund view,
finalize button, seller controls.

## 7. Security goals
- No reentrancy on any ETH payout
- Bidder funds can only go to the bidder (or, for accepted amounts, the seller)
- Correct rounding: no wei created or lost, tokens never over-issued
- Time based on `block.timestamp`

## 8. Out of scope
Whitelists, multiple auctions, upgradeability, mainnet deployment.

## 9. Success criteria
- All tests in `DESIGN.md` §11 pass and Slither shows no unresolved high or medium findings
- The demo shows a full auction: start, bids, sell-out, finalize, claims, burn
- The reentrancy attack fails to drain funds
