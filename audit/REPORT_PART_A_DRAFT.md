# Report sections for Part A (draft)

## Section 4: AI-Generated Architecture

*Describes the AI's first draft (snapshot: `audit/first-draft/`, SHA-256 hashes in `SHA256SUMS`;
commit: TODO (you), "AI first draft (unreviewed)").*

The AI was given `SPEC.md`, `DESIGN.md` and the interface file, and produced four contracts:

| Contract | Role |
|---|---|
| `AuctionToken` | OpenZeppelin `ERC20` + `ERC20Burnable`. Entire supply minted once, to the auction, in the constructor. |
| `DutchAuction` | Deploys the token in its own constructor (avoiding a circular deployment). Implements `IDutchAuction`; inherits `ReentrancyGuard`. |
| `IDutchAuction` | Interface the frontend and tests build against. The AI extended it with `withdrawProceeds`, `ProceedsWithdrawn` and three extra errors. |
| `ReentrancyAttacker` | A bidder whose `receive()` tries to call `claim()` again during its refund. |

**State management in `DutchAuction`:** immutable parameters (`tokenSupply`, `startPrice`,
`reservePrice`, `seller`, `token`); time (`startTime`, `endTime`); accounting
(`totalCommitted`, `bids[user]`, `excess[user]`); outcome (`soldOut`, `clearingPrice`,
`tokensSold`, `finalized`); and `proceeds` accrued at claim time.

**Flow:**
1. `start()` (seller only, once) sets the 20-minute window.
2. `bid()` computes `maxCommit = tokenSupply * price / 1e18`. If the bid would cross it, only the
   needed amount is accepted, the surplus goes to `excess[user]`, and the auction is marked
   sold out at that price. Once demand already meets supply at the current price, further bids revert.
3. `finalize()` (anyone, once) sets the clearing price: the crossing price, or
   `max(reserve, ceil(totalCommitted / supply))`, then burns unsold tokens.
4. `claim()` (pull pattern, `nonReentrant`) computes tokens and refund, zeroes balances first, then
   transfers tokens and sends ETH with `call`.
5. `withdrawProceeds()` pays the seller only the cost accrued from claims.

**Design choices the AI made that were not in the spec:** deploying the token from the auction
constructor; guarding `bid()` against the "lazily cleared" state; accruing proceeds in `claim()`
for solvency.

## Section 7: Improvements & Refinements (fill in as you go)

Only list changes you actually make beyond the AI's baseline. So far, only these are done:

| Change | Why | Evidence |
|---|---|---|
| Spec decisions agreed by the team (refund at claim, repeat bids, start trigger, demo parameters) | Resolve spec ambiguity before generation | `SPEC.md`, git history |
| Fixed test expectation and seed script (ISSUE-001, 002) | Wrong assumptions in AI output | Passing tests, script output |

TODO (you): add rows for each fix after review, e.g. the resolution of ISSUE-003, gas
optimisations, extra events, input checks, frontend-driven interface changes.
