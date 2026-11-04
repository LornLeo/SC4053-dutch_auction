# AI Audit: Dutch Auction Token Launch (SC4053, Option 2)

**Group:** <group name> | **Members:** A <name> (contracts), B <name> (testing and security), C <name> (frontend and delivery) | **Last updated:** 2026-11-02

> **One file for the whole audit.** It replaces the separate audit log, report, prompt records and
> review notes. Sections 1 to 8 follow the order required by the course brief (§2.1), issues use the
> brief's four-part format (§2.2), and the specs and review checklist are in the appendices.
> Search for `TODO` to find what is left. Delete all lines starting with ">" before submitting.
> Convert to PDF if the portal wants a PDF.

## Status checklist (delete before submitting)

- [ ] **A:** tick Appendix C (including section 2b, the re-review of the fixes), fill commit hashes, run Slither
- [ ] **B:** add test-suite and Slither findings to §5 and §6, review A's PR
- [ ] **C:** fill §2 (frontend tooling), §3 (your prompts), §8, add UI issues to §5
- [ ] **Everyone:** add your own prompts to §3.2 and bugs to §5 as you go, not at the end
- [ ] Replace every `<name>`, `<hash>` and `TODO`; remove sections that do not apply only if the brief allows it

---

## 1. Initial Specification & System Scope

*Owner: C, with the whole team.* The requirements, contract logic and UI features the team intended to build
**before** engaging AI tools. Full text: Appendix A (`SPEC.md`) and Appendix B (`DESIGN.md`).

**Provenance (be exact):**
- `SPEC.md` and `DESIGN.md` were committed before any AI-generated contract code. Commit: TODO `<hash>`, date TODO.
- The spec was drafted with AI assistance (Claude), then discussed and decided by the team (record P0 in §3.3).
  What the team changed from the AI draft: TODO.
- After review, `DESIGN.md` and `SPEC.md` were updated to describe the ISSUE-003 and ISSUE-004 fixes (`claimFor`, deferred refunds). Commit: TODO `<hash>`. This is a documented change to the spec after code generation, not part of the original scope.

**Scope in brief:** an ERC20 token sold for ETH in a 20-minute descending-price auction. The price falls linearly from
1 ETH to 0.1 ETH per token. The auction ends when demand meets the 1,000-token supply or when time runs out. All winners
pay one uniform clearing price, surplus ETH is refunded, unsold tokens are burned.

**Key decisions:** surplus from the crossing bid is refunded at `claim()`; repeat bids accumulate; the seller starts the
clock with `start()`; refunds are pull-based so one failing recipient cannot block others.

**Features:** wallet connect, live price and countdown, bid form, claim and refund, finalize button, seller controls.
Bonus: reentrancy attack demonstration.

---

## 2. Development Methodology & AI Tooling Infrastructure

*Owner: C.*

### 2.1 Tools

| Tool / model | Used by | Used for |
|---|---|---|
| Claude (claude-sonnet-5-5), Claude Code session | A | Project plan, spec drafting, first contract draft, deploy/seed scripts, smoke and review tests, this document's templates |
| Hardhat 2.x, Chai, OpenZeppelin Contracts 5.x | A, B | Compile, test, ERC20 / ERC20Burnable / ReentrancyGuard |
| Slither | B | Static analysis. TODO: not yet run |
| TODO (frontend tooling, any AI used by C) | C | |
| TODO (any AI used by B) | B | |

### 2.2 Workflow

1. Team agreed roles and the contract interface (`IDutchAuction.sol`).
2. Spec written and committed (Appendix A, B).
3. AI generated a first draft from the spec files. It was saved untouched in `audit/first-draft/` with SHA-256 hashes.
4. A human reviewed it (Appendix C).
5. Someone other than the prompter wrote tests and ran static analysis.
6. Fixes were made in separate commits that reference the issue ID, with evidence logged in §5.

### 2.3 Custom artefacts built for the AI

`SPEC.md` (requirements), `DESIGN.md` (formulas, flows, test checklist), `contracts/IDutchAuction.sol` (the interface as
a contract between team members), this audit file. TODO: add any prompts, agents or scripts the team built.

### 2.4 Division of labour and decisions

| Member | Owns | AI use |
|---|---|---|
| A | Contracts, deployment, demo scripts | Generated contracts, scripts, tests; reviewed output |
| B | Tests, security, validation | TODO |
| C | Frontend, README, demo video, assembling this audit | TODO |

Review rotation: the person who did not prompt the AI reviews its output. TODO: confirm this is what happened.

---

## 3. Specification Engineering & Prompt Logs

*Owner: everyone for their own prompts.*

### 3.1 Spec files given to the AI

`SPEC.md`, `DESIGN.md`, `contracts/IDutchAuction.sol`, and the course brief (Option 2). The generation prompt was short;
the real instructions were in these files, so this is spec-driven generation.

### 3.2 Prompt log

Only the prompts that shaped the code or fixed issues are listed, as summaries. Prompts about local setup, audit
formatting and document merging are left out because they did not change the contracts.

| # | Date | Who | Tool | What was asked | Output | Kept / changed |
|---|---|---|---|---|---|---|
| P0 | 2026-10-27 to 10-31 | A | Claude | Plan the project and write the spec (a generic `SPEC.md` plus a technical `DESIGN.md`) | SPEC.md, DESIGN.md, interface | Kept. Team edits: TODO |
| P1 | 2026-10-31 | A | Claude | Generate the contracts, deploy/seed scripts and smoke tests from the spec files | Contracts, scripts, 6 smoke tests | Baseline, then reviewed |
| P2 | 2026-10-31 | A | Claude | Review the first draft and write tests for its weak points | ISSUE-003 and ISSUE-004 found and reproduced by tests | Kept |
| P3 | 2026-11-03 | A | Claude | Fix ISSUE-003 and ISSUE-004 | `claimFor`, `pendingRefund` / `withdrawRefund`, regression tests | Kept. A's edits: TODO |
| P4+ | | B / C | | TODO: add only prompts that shaped code or fixed issues | | |

### 3.3 Prompt records

**P0: spec.** Context: the course brief. Asked for a project plan, a split of work for three people and a spec. Output:
`SPEC.md` (what and why), `DESIGN.md` (formulas, flows, test checklist), `IDutchAuction.sol`. The four open design
decisions (refund timing, repeat bids, demo parameters, start trigger) were put to A, who chose the AI's recommended
options. Team changes after the draft: TODO.

**P1: first draft of the contracts.** Context: `SPEC.md`, `DESIGN.md`, `IDutchAuction.sol`, the brief, Hardhat plus
OpenZeppelin v5. Asked for the contracts for Part A and the supporting scripts and tests. Output: `AuctionToken.sol`,
`DutchAuction.sol`, `ReentrancyAttacker.sol`, an extended interface, `scripts/deploy.js`, `scripts/seed.js`, smoke tests.
Snapshot: `audit/first-draft/` (hashes in `SHA256SUMS`); the contracts in the repo were byte-identical to it when
written. Problems noticed while running: ISSUE-001, ISSUE-002. Outcome: baseline, reviewed by A on TODO date.

**P2: review and adversarial tests.** Context: the first-draft source. Asked the AI to re-read its own contract as a
reviewer and write tests for what it found. Output: two findings (ISSUE-003, ISSUE-004), each reproduced by a test that
passed against the first draft, which proved the problem existed. Outcome: findings kept; decision to fix them taken by
A on TODO date.

**P3: fixes.** Context: the two reproduction tests and the first-draft source. Asked for fixes that keep the accounting
solvent and leave the first-draft snapshot untouched. Output: `claimFor(address)`, deferred refunds with
`withdrawRefund(to)`, rewritten regression tests, updated interface, `SPEC.md` and `DESIGN.md`. One test used a
Hardhat time-travel method that does not exist and failed once; it was corrected before the fix was accepted.
Outcome: kept after review by A on TODO date.

---

## 4. AI-Generated Architecture

*Owner: A.* The AI's first draft, before human edits. Commit "AI first draft (unreviewed)": TODO `<hash>`.

| Contract | Role |
|---|---|
| `AuctionToken` | OpenZeppelin `ERC20` + `ERC20Burnable`. The whole supply is minted once to the auction in its constructor. |
| `DutchAuction` | Deploys the token in its own constructor. Implements `IDutchAuction`, inherits `ReentrancyGuard`. |
| `IDutchAuction` | Interface the frontend and tests build against. The AI added `withdrawProceeds`, `ProceedsWithdrawn` and extra errors. |
| `ReentrancyAttacker` | Bonus: a bidder whose `receive()` tries to re-enter `claim()`. |

**State:** immutable parameters (`tokenSupply`, `startPrice`, `reservePrice`, `seller`, `token`); time (`startTime`,
`endTime`); accounting (`totalCommitted`, `bids`, `excess`); outcome (`soldOut`, `clearingPrice`, `tokensSold`,
`finalized`); `proceeds` accrued at claim time.

**Flow:**
1. `start()` opens the 20-minute window (seller only, once).
2. `bid()` accepts ETH up to `maxCommit = tokenSupply * price / 1e18`. The crossing bid is partly accepted, the surplus
   goes to `excess`, and the auction sells out at that price. Once demand already meets supply, further bids revert.
3. `finalize()` fixes the clearing price (the crossing price, otherwise `max(reserve, ceil(committed / supply))`) and
   burns unsold tokens.
4. `claim()` (pull pattern, `nonReentrant`) zeroes balances first, then transfers tokens and sends the refund with `call`.
5. `withdrawProceeds()` pays the seller only the cost accrued from claims.

**Choices the AI made beyond the spec:** deploying the token from the auction constructor; guarding `bid()` against the
"lazily cleared" state; accruing proceeds in `claim()` for solvency.

**Changes made after review (not part of the first draft):** `claimFor(address)`, `pendingRefund` and `withdrawRefund(to)` (ISSUE-003, ISSUE-004). See §5 and §7. The first draft remains in `audit/first-draft/` for comparison (`git diff` against the "AI first draft (unreviewed)" commit shows the change).

---

## 5. Problems Discovered & Vulnerability Analysis

*Owner: B (with A for contract issues, C for frontend issues).*

### 5.1 Inventory

| ID | Title | Severity | Category | Found by | Status |
|---|---|---|---|---|---|
| ISSUE-001 | Test hard-coded the wrong refund | Low | Test / time assumption | Running the AI's tests | Fixed |
| ISSUE-002 | Seed script did not cross the threshold | Low | Demo script | Arithmetic check | Fixed |
| ISSUE-003 | Unclaimed bids lock proceeds and tokens | Medium | Logic / availability | AI review of its own draft, reproduced by test | Fixed |
| ISSUE-004 | A bidder that cannot receive ETH cannot claim tokens | Low | Logic / refund handling | AI review of its own draft, reproduced by test | Fixed |
| ISSUE-005 | Setup instructions targeted the wrong Hardhat version | Low | Toolchain | Manual setup | Fixed |
| ISSUE-006+ | TODO (B, C): add from tests, Slither, UI testing | | | | |

### 5.2 Issue breakdowns (brief §2.2 format)

#### ISSUE-001: Smoke test hard-coded the wrong refund amount
- **Found by / date / how:** AI session, 2026-10-31, failing test `reentrancy attacker cannot claim twice`
- **Severity / location:** Low (test error, not a contract bug); `test/DutchAuction.smoke.test.js`
- **What the AI generated:** `expect(gained).to.be.lte(E("200.01"))`, assuming the crossing bid's surplus is exactly 200 ETH.
- **1. Why the AI made the mistake:** it assumed the price is exactly 1 ETH at bid time. Hardhat advances `block.timestamp` about a second per block, so the price had already dropped to about 0.9985 and the surplus was 201.5 ETH. The AI did not model time passing between transactions.
- **2. Why it is problematic:** a wrong expected value looks like a contract bug (a refund overpayment), or tempts people to loosen the assertion until it proves nothing.
- **3. How it was fixed:** compare the attacker's balance change with the contract's own `refundFor(attacker)`.
- **4. Evidence the fix works:** before: `AssertionError: expected 201500000000000000001 to be at most 200010000000000000000`. After: all tests pass (`audit/test-output.txt`).
- **Commit:** TODO `<hash>`

#### ISSUE-002: Seed script's last bid did not cross the sell-out threshold
- **Found by / date / how:** AI session, 2026-10-31, arithmetic check then running the script
- **Severity / location:** Low (demo script); `scripts/seed.js`
- **What the AI generated:** bids of 300, 250 and 400 ETH, with a comment claiming the last bid pushes demand past supply.
- **1. Why the AI made the mistake:** it sized the bids without summing them against the sell-out amount (about 1000 ETH); 950 is below it.
- **2. Why it is problematic:** the demo would not show partial fill and refund, and the comment was false.
- **3. How it was fixed:** the last bid was changed to 600 ETH.
- **4. Evidence the fix works:** script output `Sold out: true | clearing price: 0.99775`.
- **Commit:** TODO `<hash>`

#### ISSUE-003: Unclaimed bids lock the seller's proceeds and the bidder's tokens
- **Found by / date / how:** the AI's re-read of its own first draft (P2), 2026-10-31; reproduced by a test that passed against the first draft. Confirmed by A: TODO (write "read the test and ran it on <date>" only if you did).
- **Severity / location:** Medium (availability, not theft); `DutchAuction.sol` `claim()` (`proceeds += cost`) and `withdrawProceeds()`
- **What the AI generated:** proceeds accrue only when each bidder calls `claim()`. This came from `DESIGN.md` §7, written to keep the contract solvent despite rounding.
- **1. Why the AI made the mistake:** it followed the spec faithfully. The spec itself ignored bidders who never claim, and the AI did not question that gap.
- **2. Why it is problematic:** if a winning bidder never claims, their cost and any refund stay in the contract and the seller never receives that ETH. No theft is possible, but funds can be stranded indefinitely.
- **3. How it was fixed:** added `claimFor(address bidder)`. It runs the same settlement as `claim()` but anyone may call it, and tokens and refund always go to the bidder, never the caller. The seller (or a keeper script reading `BidPlaced` events) can settle every bidder, so nobody can lock the proceeds. The settlement logic moved into one internal function `_claim`, so there is a single code path. Options considered and rejected: a sweep deadline would let the seller take bidder funds, which breaks the security goal that the seller never touches bidder ETH beyond accrued proceeds; accepting the limitation would leave funds stranded.
- **4. Evidence the fix works:** before the fix, the reproduction test showed the seller receiving less than `totalCommitted` and over 390 ETH still locked (`audit/test-output-before-fix.txt`). After: 3 regression tests pass: a third party settles a non-claiming bidder and the contract ends with exactly 0 ETH after `withdrawProceeds()`; double settlement and settlement before finalize revert; an address with no bid reverts (`audit/test-output.txt`, 14 passing).
- **Residual risk:** someone still has to call `claimFor` for each non-claiming bidder (a loop script or the UI). A bidder contract can burn gas in `receive()`, so a third-party `claimFor` may need a higher gas limit; the bidder can always claim themselves.
- **Commit:** TODO `<hash of fix commit>`

#### ISSUE-004: A bidder that cannot receive ETH cannot claim its tokens
- **Found by / date / how:** the AI's re-read of its own first draft (P2), 2026-10-31; reproduced by a test using `contracts/mocks/NoReceiveBidder.sol`. Confirmed by A: TODO (same note as ISSUE-003).
- **Severity / location:** Low (affects only that bidder's funds); `DutchAuction.sol` `claim()`: `if (!sent) revert TransferFailed()`
- **What the AI generated:** `claim()` transfers tokens, then sends the ETH refund with `call`. A failed send reverts the whole claim, including the token transfer.
- **1. Why the AI made the mistake:** it treated a failed refund as an error to propagate (a common safe default) without considering that this also blocks the tokens that were due.
- **2. Why it is problematic:** a smart-contract bidder with no `receive()` function and a refund due (any crossing bid) cannot get its tokens either. Other bidders are unaffected, so the risk is limited and self-inflicted, but the lock is avoidable.
- **3. How it was fixed:** if the refund `call` fails, the claim no longer reverts. The tokens are delivered, the refund is recorded in `pendingRefund[bidder]` with a `RefundDeferred` event, and the bidder can later call `withdrawRefund(to)` to send it to any non-zero address (so a contract wallet can redirect it). Balances are zeroed before every send and all functions are `nonReentrant`.
- **4. Evidence the fix works:** before the fix, the test showed `claim()` reverting with `TransferFailed` and the bidder holding 0 tokens (`audit/test-output-before-fix.txt`). After: 5 regression tests pass: tokens delivered with the refund deferred; refund recovered to another address; a third-party `claimFor` on a contract bidder does not revert; `withdrawRefund` rejects the zero address and empty balances; a final solvency test ends with 0 ETH in the contract (`audit/test-output.txt`).
- **Residual risk:** none beyond the gas note in ISSUE-003.
- **Commit:** TODO `<hash of fix commit>`

#### ISSUE-005: Setup instructions targeted the wrong Hardhat version and hit several toolchain problems
- **Found by / date / how:** A, 2026-10-31, manual setup on a Windows ARM laptop, errors pasted back to the AI
- **Severity / location:** Low (tooling, cost about an hour); project setup (`package.json`, Hardhat config)
- **What the AI generated:** unpinned `npm install --save-dev hardhat` then `npx hardhat init` "JavaScript project", plus bash commands given to a PowerShell user.
- **1. Why the AI made the mistake:** an unpinned install gets the latest major, now Hardhat 3, whose scaffold is TypeScript/ESM with `forge-std` from GitHub. The generated code targeted Hardhat 2 (JS config, CommonJS, hardhat-toolbox 5). The AI never asked about the OS or Node/npm versions, and at first trusted Hardhat's own error text (an "npm bug") instead of checking the cause.
- **2. Why it is problematic:** the contracts, tests and scripts could not run, and several wrong fixes were tried. Errors seen: `HHE27 missing solidity-analyzer-win32-arm64-msvc`, `EALLOWGIT forge-std`, `ts-node ... fileExists` (TypeScript 7 incompatible with ts-node), and a leftover `hardhat.config.ts` in a parent folder that Hardhat 2 picked up first.
- **3. How it was fixed:** reset to Hardhat 2 with pinned versions (`hardhat@^2.22`, `hardhat-toolbox@^5`, `typescript@^5.6`), x64 Node, removed the Hardhat 3 sample files and the stray config, removed npm 12 from the user folder.
- **4. Evidence the fix works:** `npx hardhat test` passes (`audit/test-output.txt`).
- **Commit:** TODO `<hash>` ("Switch scaffold to Hardhat 2")

### 5.3 Template for a new issue (copy and fill)

#### ISSUE-00X: <short title>
- **Found by / date / how:** (manual review / Slither / unit test / fuzz / UI testing)
- **Severity / location:** Critical / High / Medium / Low; file and function
- **What the AI generated:** (paste the buggy snippet)
- **1. Why the AI made the mistake:** (hallucinated syntax, misread the spec, no context on reentrancy, wrong rounding, web3 state...)
- **2. Why it is problematic:** (real-world impact: drainable funds, stuck tokens, wrong price...)
- **3. How it was fixed:** (code diff, manual change, or re-prompt / spec update)
- **4. Evidence the fix works:** (test log, Slither before/after, tx hash, screenshot)
- **Commit:** `<hash>`

### 5.4 Checks that found nothing

State only what a person verified. From A's review: reentrancy in `claim` and `withdrawProceeds` is blocked by
`nonReentrant` and zeroed balances (attacker test: re-entry attempted once, did not succeed); `bid()` makes no external
call; overflow is not possible at demo values; accounting uses tracked variables, not `address(this).balance`.
TODO (A): keep only what you confirmed in Appendix C.

---

## 6. Validation Process & Testing Strategy

*Owner: B (A for the tests listed).*

### 6.1 Tests

| Suite | Owner | Covers | Result |
|---|---|---|---|
| `test/DutchAuction.smoke.test.js` (6) | A | Price decay, crossing bid and refund, never-sold-out burn, lazy clear, reentrancy | Pass |
| `test/PartA.review.test.js` (8) | A | Regression tests for the ISSUE-003 and ISSUE-004 fixes, including a solvency check | Pass |
| TODO: B's suite against `DESIGN.md` §11 (price boundaries, timing, rounding, double claim, fuzz/invariants) | B | | |

Command: `npx hardhat test`. Current output (14 passing): `audit/test-output.txt`. Output from before the fixes (8 passing, with tests that documented the problems): `audit/test-output-before-fix.txt`.

### 6.2 Static analysis

| Date | Command | Findings before | Findings after | Notes |
|---|---|---|---|---|
| TODO | `slither .` (save to `audit/slither-before.txt` / `slither-after.txt`) | | | |

Not yet run. Log each finding in §5 as fixed, accepted, or a false positive with the reason.

### 6.3 Manual review and simulation

- Contract review: Appendix C, reviewed by A. PR review by TODO (B).
- Local simulation: `npx hardhat node` plus `scripts/seed.js`, then finalize and claim from the console or UI. TODO (C): UI testing notes and screenshots in `audit/screenshots/`.

---

## 7. Improvements & Refinements

*Owner: A, B, C for their own changes.*

| Change | Why | Evidence |
|---|---|---|
| Spec decisions agreed by the team (refund at claim, repeat bids, explicit start, demo parameters) | Resolve ambiguity before generation | Appendix A, git history |
| Fixed test expectation and seed script (ISSUE-001, 002) | Wrong assumptions in AI output | Passing tests, script output |
| Switched to Hardhat 2 with pinned versions (ISSUE-005) | Match code and avoid toolchain breakage | Passing tests |
| Added `claimFor(address)` so anyone can settle a bidder (ISSUE-003) | Stop non-claiming bidders from locking the seller's proceeds | 3 regression tests, `audit/test-output.txt`, commit TODO |
| Failed refunds are deferred to `pendingRefund` and withdrawn with `withdrawRefund(to)` (ISSUE-004) | An undeliverable refund no longer blocks the tokens | 5 regression tests, commit TODO |
| Updated `SPEC.md`, `DESIGN.md` and the interface to match the fixes | Keep spec and code in step | Appendix A, B, commit TODO |
| TODO: gas optimisations, extra checks, UX improvements | | |

---

## 8. Lessons Learned

- **Where AI excelled:** a spec-conforming contract that compiled on the first attempt, consistent checks-effects-interactions and `nonReentrant`, explicit rounding handling, a working attacker contract.
- **Where AI failed:** tests that ignored time passing, an arithmetic slip in demo data, accepting a spec gap without questioning it, safe-default error handling that blocked tokens, unpinned and OS-blind setup instructions.
- **Recommendations for future AI-driven dApp work:** pin versions in every instruction; ask for the OS and tool versions first; ask the AI for adversarial tests (non-claiming and contract bidders) before happy paths; review the spec for "what if a user never acts?"; keep the AI's first draft untouched in version control; never let the AI grade its own work, so a different person runs tests and static analysis.
- TODO (A, B, C): add your own observations.

---

## Appendix A: SPEC.md (requirements)

What we are building and why. Technical detail is in `DESIGN.md`. Written before any
AI-generated contract code; AI assistance in drafting it is recorded in
`AI_AUDIT.md` §3.3 (P0).

#### 1. Goal
A token launch where an ERC20 token is sold for ETH through a descending-price (Dutch)
auction lasting exactly 20 minutes. Every winner pays the same clearing price, surplus ETH is
refunded, and unsold tokens are burned.

#### 2. Problem it solves
Fixed-price sales cause gas wars, mis-priced tokens and bot front-running. A descending
price with a uniform clearing price lets the market find the price and treats all bidders
equally.

#### 3. Actors
- **Seller:** deploys, starts the auction, withdraws the proceeds
- **Bidder:** commits ETH, then claims tokens and any refund
- **Anyone:** can finalize the auction once it has ended or sold out, and can settle any bidder's claim for them

#### 4. Core behaviour
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

#### 5. Key decisions
| Topic | Decision |
|---|---|
| Surplus ETH from the crossing bid | Refunded at claim, not during the bid |
| Repeat bids | Allowed, they accumulate |
| Demo parameters | 1,000 tokens, price 1 ETH down to 0.1 ETH per token |
| Start | Seller calls `start()`; the clock begins then |
| Refunds | Pull-based, so one failing recipient cannot block others |
| Non-claiming bidders | Anyone can call `claimFor(bidder)`; funds always go to the bidder |
| Undeliverable refunds | Held in `pendingRefund`, withdrawn with `withdrawRefund(to)` |

#### 6. Features
**Contracts:** ERC20 token, auction engine, reentrancy attacker (bonus demo).
**Frontend:** connect wallet, live price and countdown, bid form, claim and refund view,
finalize button, seller controls.

#### 7. Security goals
- No reentrancy on any ETH payout
- Bidder funds can only go to the bidder (or, for accepted amounts, the seller)
- Correct rounding: no wei created or lost, tokens never over-issued
- Time based on `block.timestamp`

#### 8. Out of scope
Whitelists, multiple auctions, upgradeability, mainnet deployment.

#### 9. Success criteria
- All tests in `DESIGN.md` §11 pass and Slither shows no unresolved high or medium findings
- The demo shows a full auction: start, bids, sell-out, finalize, claims, burn
- The reentrancy attack fails to drain funds

---

## Appendix B: DESIGN.md (technical design)

Detailed design behind `SPEC.md`: exact formulas, rounding, function flows, invariants. This is
the file given to AI coding tools alongside `SPEC.md`. Changes go through a PR and are noted in
`AI_AUDIT.md`.

#### 1. Goal

Sell a fixed supply of an ERC20 token for ETH through a descending-price auction lasting
exactly 20 minutes. All winners pay the same uniform clearing price. Surplus ETH is
refunded. Unsold tokens are burned.

#### 2. Decisions (agreed by the team)

| Topic | Decision |
|---|---|
| Refund of the threshold-crossing excess | Credited at `claim()`. `bid()` makes no external calls. |
| Repeat bids | Allowed. `bids[user]` accumulates. |
| Demo parameters | 1,000 tokens, start 1 ETH, reserve 0.1 ETH (per whole token) |
| Start trigger | Explicit `start()` call by the deployer; the 20-minute clock begins then |
| Bidders who never claim | `claimFor(address)` lets anyone settle a bidder; tokens and refund always go to the bidder (added after review, ISSUE-003) |
| Refund that cannot be delivered | Held in `pendingRefund` and withdrawn with `withdrawRefund(to)`; never blocks the tokens (added after review, ISSUE-004) |

#### 3. Contracts

| Contract | Purpose |
|---|---|
| `AuctionToken.sol` | OpenZeppelin ERC20 + `ERC20Burnable`. Entire supply minted to the auction in its constructor. |
| `DutchAuction.sol` | Deploys the token, runs price decay, bidding, clearing, finalize, claims. Inherits `ReentrancyGuard`. |
| `ReentrancyAttacker.sol` | Bonus: malicious bidder that tries to re-enter `claim()`. |

Interface: `contracts/IDutchAuction.sol`.

#### 4. Parameters (constructor)

| Name | Meaning | Demo value |
|---|---|---|
| `tokenSupply` | Tokens for sale, 18 decimals | 1,000e18 |
| `startPrice` | Wei per whole token (1e18 base units) at t = 0 | 1 ether |
| `reservePrice` | Price floor, wei per whole token | 0.1 ether |
| `DURATION` | Auction length (constant) | 20 minutes |

Constructor requires `startPrice > reservePrice > 0` and `tokenSupply > 0`. The deployer is
the `seller`.

#### 5. Price function

Linear decay on `block.timestamp` (never block numbers):

```
before start()            -> auction not started
startTime <= t < endTime  -> startPrice - (startPrice - reservePrice) * (t - startTime) / DURATION
t >= endTime              -> reservePrice
```

Multiply before dividing. The price is non-increasing and never below `reservePrice`.

All amounts: tokens in base units (1e18 = 1 token), ETH in wei, price in wei per whole token.
`tokens = ethWei * 1e18 / price`.

#### 6. Bidding and clearing

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

#### 7. Settlement

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

#### 8. Interface summary

Functions: `start`, `bid`, `finalize`, `claim`, `claimFor`, `withdrawRefund`, `withdrawProceeds`, views
`currentPrice`, `timeRemaining`, `totalCommitted`, `bids`, `pendingRefund`, `clearingPrice`, `tokensFor`,
`refundFor`, `startTime`, `endTime`, `startPrice`, `reservePrice`, `tokenSupply`, `finalized`.
Events: `AuctionStarted`, `BidPlaced`, `AuctionCleared`, `AuctionFinalized`, `Claimed`,
`ProceedsWithdrawn`, `RefundDeferred`, `RefundWithdrawn`. All are in `contracts/IDutchAuction.sol`.

#### 9. Security requirements

- `ReentrancyGuard` on `bid`, `claim`, `claimFor`, `withdrawRefund`, `withdrawProceeds`
- Checks-effects-interactions: zero balances before any transfer
- ETH sent with `call`, return value checked, custom error on failure
- Solidity 0.8.x; document every rounding direction
- Seller can never touch bidder ETH except accrued `proceeds`
- `claimFor` only ever pays the bidder, so a third party cannot redirect funds
- Custom errors; an event for every state change
- Invariants: contract ETH >= everything owed; total tokens claimed <= `tokensSold` <= supply

#### 10. Frontend (React + ethers + MetaMask, local Hardhat node)

- Connect wallet; show network, account, ETH balance
- Status: Not started / Active / Sold out / Ended / Finalized
- Live price and countdown (from `startTime` and chain time)
- Total committed, tokens remaining at current price
- Bid form with estimated tokens at current price and a warning that the final price is the
  clearing price, not the bid-time price
- After finalize: tokens and refund preview, Claim button
- Finalize button (anyone), Start and Withdraw buttons visible to the seller only
- Show transaction status and decoded errors

#### 11. Test checklist

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

#### 12. Out of scope

Whitelists, multiple auctions, upgradeability, mainnet deployment, off-chain order books.

#### 13. Demo plan (for the video)

1. Deploy locally, show token and auction addresses
2. `start()`, show the price falling on the UI
3. Three accounts bid at different prices; show committed total rising
4. Crossing bid triggers sell-out; show clearing price
5. `finalize()`, then each account claims; show tokens, refunds and the burn
6. Run the reentrancy attacker test and show it failing to drain funds

---

## Appendix C: Part A contract review checklist

**Reviewer:** <your name> | **Date:** 2026-10-31 | **Files:** `contracts/AuctionToken.sol`, `DutchAuction.sol`, `ReentrancyAttacker.sol`, `IDutchAuction.sol`
**Baseline:** commit `<hash of "AI first draft (unreviewed)">`. Sections 1 and 2 review the first draft. Section 2b reviews the code after the ISSUE-003 and ISSUE-004 fixes (commit `<hash of the fix commit>`).

> **How to use this file.** The "AI reading notes" column is what an AI-assisted re-read of the
> code found, so it is a starting point. The "Confirmed by me" box is for **you**: tick it only
> for things you personally checked, and write what you saw in "My notes". Delete any row you did
> not actually review. A review record that overstates what you did is worse than a short one.

#### 1. Function-by-function review

| Area | What it should do (from DESIGN.md) | AI reading notes | Confirmed by me | My notes |
|---|---|---|---|---|
| `currentPrice()` | Linear decay on `block.timestamp`, floor at reserve, multiply before divide | Computes `startPrice - (range * elapsed) / DURATION`. Division happens last, so no early precision loss. Floors at `reservePrice` after `endTime`. Returns `startPrice` before `start()` (UI convenience). | [ ] | |
| `start()` | Seller only, once | Reverts `NotSeller` / `AlreadyStarted`. Sets `endTime = start + 20 min`. | [ ] | |
| `bid()` | Accept ETH while active. Crossing bid is partly accepted. | No external calls, so reentrancy surface is small (also `nonReentrant`). `accepted = maxCommit - totalCommitted` on the crossing bid, surplus to `excess[]`. Guard `totalCommitted >= maxCommit` blocks bids once demand already meets supply. `accepted` is at least 1 wei when this branch is reached. | [ ] | |
| Crossing maths | `committed == floor(supply * p / 1e18)` at crossing | Total tokens claimable = `committed * 1e18 / p <= supply`. Rounds down, so never over-issues. | [ ] | |
| `finalize()` | Sets clearing price, burns unsold, callable once | `finalized = true` set before the external `burn`. Lazy price: `max(reserve, ceil(committed * 1e18 / supply))`. `ceil` guarantees claims never exceed supply. Zero bids gives reserve price and burns everything. | [ ] | |
| `claim()` | Pull tokens + refund, CEI, nonReentrant | Balances zeroed before any transfer. `cost + refund == bids + excess` holds for every user, so no wei is created. Tokens transferred before ETH. If the ETH send fails the whole claim reverts (see ISSUE-004). | [ ] | |
| `withdrawProceeds()` | Seller only, after finalize | Zeroes `proceeds` before sending. Only pays cost accrued from claims (see ISSUE-003). | [ ] | |
| Views | `tokensFor`, `refundFor`, `timeRemaining` | Return 0 before finalize. `refundFor` mirrors `claim()` maths. | [ ] | |
| `AuctionToken` | Whole supply minted to auction; burnable | Minted once in the constructor. `burn` uses `ERC20Burnable` (burns from the caller = the auction). | [ ] | |
| `ReentrancyAttacker` | Try to re-enter `claim()` in `receive()` | Uses try/catch so the outer claim still succeeds and the test can show the attempt was blocked. Two layers stop it: `nonReentrant` and zeroed balances (a second claim would revert `NothingToClaim` anyway). | [ ] | |
| Interface vs DESIGN.md | Names, events, errors match | Interface extended with `withdrawProceeds`, `ProceedsWithdrawn`, `NotSeller`, `AlreadyStarted`, `InvalidParams`. | [ ] | |

#### 2. Cross-cutting checks

| Check | AI reading notes | Confirmed by me | My notes |
|---|---|---|---|
| Reentrancy on every ETH send (`claim`, `withdrawProceeds`) | Both `nonReentrant` and use checks-effects-interactions | [ ] | |
| ETH sent with `call`, return value checked | Yes, custom error `TransferFailed` | [ ] | |
| Overflow | Solidity 0.8 checked arithmetic. `tokenSupply * p` is about 1e39 at demo values, far below 2^256 | [ ] | |
| Timestamp dependence | Miners/validators can shift `block.timestamp` by seconds. Effect on a 20-minute linear price is negligible. Accept and state this. | [ ] | |
| Forced ETH (selfdestruct) | Accounting uses tracked variables, not `address(this).balance`, so forced ETH cannot break maths | [ ] | |
| Access control | Only `start()` and `withdrawProceeds()` are privileged. Seller cannot touch bidder ETH other than accrued proceeds | [ ] | |
| Gas / DoS | No loops over bidders. No unbounded arrays | [ ] | |

#### 2b. Re-review of the fixes (do this yourself against the current code)

| Area | What it should do | AI reading notes | Confirmed by me | My notes |
|---|---|---|---|---|
| `claimFor(bidder)` / `_claim` | Tokens and refund go to `bidder`, never `msg.sender`; same effects-before-interactions order as before | `claim()` and `claimFor()` both call `_claim(bidder)`. Balances are zeroed before any transfer. Both are `nonReentrant`. | [ ] | |
| Deferred refund | A failed refund call must not revert the claim | Tokens are transferred first. If the ETH `call` fails, `pendingRefund[bidder] += refund` and `RefundDeferred` is emitted. `Claimed` reports only the refund actually paid. | [ ] | |
| `withdrawRefund(to)` | Pay a deferred refund to any non-zero address | Zeroes `pendingRefund` before the send, rejects the zero address, reverts `NothingToClaim` when nothing is pending, `nonReentrant`. | [ ] | |
| Reentrancy after the change | Re-entry during the refund call must fail | Every state-changing function is `nonReentrant`, so a re-entry into `claim`, `claimFor`, `withdrawRefund`, `withdrawProceeds`, `bid` or `finalize` reverts. The attacker smoke test still passes. | [ ] | |
| Forced settlement | Third-party `claimFor` must not hurt the bidder | Tokens and refund still go to the bidder. The only effect is on timing: a bidder can be settled earlier than they chose. | [ ] | |
| Gas griefing | A bidder contract can burn gas in `receive()` | `call` forwards all available gas, so a gas-burning `receive()` can make a third party's `claimFor` expensive or fail at a low gas limit. Only the caller of `claimFor` is affected; the bidder can always claim themselves. Residual risk, see ISSUE-003. | [ ] | |
| Solvency | Contract ETH covers everything owed | Balance is at least `proceeds` + unsettled `bids` + `excess` + `pendingRefund`. The solvency test ends with a balance of exactly 0. | [ ] | |
| Interface vs DESIGN.md | New names and events match | `claimFor`, `withdrawRefund`, `pendingRefund`, `RefundDeferred`, `RefundWithdrawn` are in the interface and in DESIGN.md §7 to §8. | [ ] | |

#### 3. Findings from this review

| ID | Summary | Backed by test | Status |
|---|---|---|---|
| ISSUE-003 | Bidders who never claim leave their ETH and the seller's share locked | `test/PartA.review.test.js` | Fixed with `claimFor`, commit `<hash>` |
| ISSUE-004 | A contract bidder that cannot receive ETH cannot claim its tokens either | `test/PartA.review.test.js` | Fixed with `pendingRefund` and `withdrawRefund`, commit `<hash>` |

Findings from my own manual read, not in the AI notes: <TODO (you): write any, or "none beyond the above">

#### 4. What I did not review
- Slither / static analysis: not yet run
- Full test suite, fuzz and invariants: owned by B
- Frontend integration: owned by C

#### 5. Sign-off
I reviewed the contracts on the date above and confirmed the rows I ticked. <your name>

---

## Appendix D: Evidence index

| Evidence | Location |
|---|---|
| Untouched AI first draft and SHA-256 hashes | `audit/first-draft/` |
| Test output after the fixes | `audit/test-output.txt` |
| Test output before the fixes | `audit/test-output-before-fix.txt` |
| Slither output | `audit/slither-before.txt`, `audit/slither-after.txt` (TODO) |
| Screenshots | `audit/screenshots/` |
| Git history | `git log --oneline` (referenced hashes above) |

