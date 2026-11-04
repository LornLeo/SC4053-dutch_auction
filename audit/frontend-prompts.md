# Frontend prompt chain (Role C)

These are the prompts for building the frontend and finding its bugs, in the order to run them. They are listed in
`AI_AUDIT.md` §2.3 as a custom artefact.

**How to use**
- Run them in order and use a fresh AI session for each phase (Build, then Find bugs), so the reviewer does not just
  approve its own memory of the code.
- Attach the files named under **Context** to each prompt.
- After every prompt, add a row to the log at the bottom. Then copy the rows that shaped code or found or fixed a bug
  into `AI_AUDIT.md` §3.2 as P4, P5, and so on.
- Before you fix anything, commit the AI's output untouched (see F1 and the commit plan).
- Never paste a real private key or seed phrase into a prompt. The Hardhat test keys are public, but there is no reason
  to paste them either.

---

## Phase 0: Spec (before any frontend code)

### F0: Draft the frontend spec

**Context:** `SPEC.md`, `DESIGN.md`, `contracts/IDutchAuction.sol`, `contracts/DutchAuction.sol`, the course brief (Option 2)

```text
I am the frontend owner of a 3-person SC4053 project: a 20-minute Dutch auction token launch on a local
Hardhat 2 node (chain id 31337). The contracts are finished and must not change. The attached SPEC.md,
DESIGN.md (§10 is the current frontend summary) and contracts are the source of truth.

Write FRONTEND_SPEC.md for the AI coding tool that will build the UI. Do NOT write any code yet.
It must cover:
1. Stack: React + Vite (JavaScript), ethers v6, MetaMask. Say which versions you would pin and why.
2. Screens and components, and which contract function or view each one uses.
3. Every auction status (Not started / Active / Sold out / Ended / Finalized), the exact on-chain
   condition for each, and which buttons are enabled in each status and for which role (seller, bidder, anyone).
4. Units and maths: wei, wei per whole token, 1e18 base units; the formulas the UI shows (current price,
   maxCommit, tokens remaining, estimated tokens for a bid, tokens and refund after finalize) written exactly
   as the contract computes them.
5. Time: where the countdown and price come from, given that Hardhat only advances time when blocks are mined.
6. How the ABI and deployed address reach the frontend after each deploy.
7. Wallet and network handling: connect, wrong network, account switch, node restart.
8. Transaction feedback and how custom errors are decoded and shown.
9. Acceptance criteria I can test by hand for each feature.

Where a decision is open, list the options with a recommendation and ask me. Don't decide for me.
```

> You decide the open questions, edit the spec yourself, then commit it **before F1**.
> Commit message: `Frontend spec (before AI code)`. Record in §1 what you changed from the AI's draft.

---

## Phase 1: Build

### F1: Scaffold and contract plumbing

**Context:** `FRONTEND_SPEC.md`, `DESIGN.md`, `scripts/deploy.js`, `scripts/seed.js`, `package.json`, `hardhat.config.js`

```text
Following FRONTEND_SPEC.md, set up the frontend. Do not modify anything in contracts/.
1. Create a Vite + React (JavaScript) app in frontend/ at the repo root. Pin dependency versions.
2. Add a small helper used by scripts/deploy.js and scripts/seed.js that writes
   frontend/src/contracts.json containing chainId, the DutchAuction address, the AuctionToken address,
   and the DutchAuction and AuctionToken ABIs read from artifacts/. Change the two scripts by the
   minimum needed to call it, and show me the diff for those two files separately.
3. Create frontend/src/lib/contract.js: build the provider and signer from MetaMask (window.ethereum)
   and export read and write contract instances.
4. List every command I need, for Windows PowerShell, to run the node, deploy and start the dev server.
Explain any assumption you make about the project setup.
```

> Commit the output untouched: `AI first draft frontend (unreviewed)`. Record the hash in §4.

### F2: Wallet and network

**Context:** `FRONTEND_SPEC.md`, the F1 output

```text
Implement the wallet layer described in FRONTEND_SPEC.md §7:
- Connect button, connected account (shortened), network name and chain id, ETH balance, AUC token balance.
- If the chain id is not 31337: show a clear banner and a "Switch to Hardhat Local" button
  (wallet_switchEthereumChain, falling back to wallet_addEthereumChain).
- React to accountsChanged and chainChanged without a page reload, and clean up listeners.
- If contracts.json's address has no code on the chain (node restarted, not redeployed), show
  "Contract not deployed on this network, run the deploy script".
Put this in a WalletProvider context plus a useWallet() hook. Explain how state flows.
```

### F3: Auction state hook

**Context:** `FRONTEND_SPEC.md`, `contracts/DutchAuction.sol`, the F2 output

```text
Write useAuction() that returns everything the UI needs, as BigInt where it is a number:
startTime, endTime, startPrice, reservePrice, tokenSupply, totalCommitted, soldOut, finalized,
clearingPrice, tokensSold, proceeds, seller, currentPrice, timeRemaining, and for the connected
account: bids, excess, tokensFor, refundFor, pendingRefund.
Also derive: status (per FRONTEND_SPEC.md §3), maxCommit, tokens remaining, progress percentage.
Requirements:
- Time and price must agree with the contract. Explain where "now" comes from and why.
- Refresh after every confirmed transaction and on new blocks (or polling, if you justify it).
- Put pure maths and status derivation in frontend/src/lib/auctionMath.js so it can be unit tested.
Explain your state-management choices in a short paragraph for the audit report.
```

### F4: Bidder view (price, countdown, bid form)

**Context:** `FRONTEND_SPEC.md`, the F3 output

```text
Build the bidder-facing components:
1. PriceCard: current price (ETH per token), start and reserve prices, and a countdown in mm:ss.
2. A chart of the linear price decay from startPrice to reservePrice over 20 minutes, with a marker
   at the current time. No heavy chart library unless you justify it.
3. ProgressCard: totalCommitted against maxCommit, tokens remaining at the current price.
4. BidForm: an ETH amount input. Show the estimated tokens at the current price and a warning that every
   winner pays the final clearing price, not the price at bid time. If the amount exceeds the ETH still
   needed to sell out, warn that only part will be accepted and the rest refunded at claim.
   Disable it unless status is Active and the wallet is on the right network.
5. MyPosition: my committed ETH, and after finalize my tokens and refund (tokensFor, refundFor).
All amounts use BigInt and ethers parseEther/formatEther, never JavaScript Number for wei.
```

### F5: Settlement view (finalize, claim, refunds, results)

**Context:** `FRONTEND_SPEC.md`, `contracts/DutchAuction.sol`, the F3 and F4 output

```text
Build the settlement components:
1. Finalize button: anyone may call it. Enabled only when (soldOut or chain time >= endTime) and not finalized.
2. Claim button for the connected account (claim()), shown after finalize when there is something to claim.
3. "Settle another bidder" form: claimFor(address) with address validation. Explain in the UI that the
   tokens and refund go to the bidder, not the caller.
4. Withdraw refund: shown only if pendingRefund > 0, with withdrawRefund(to) and `to` defaulting to my address.
5. Results panel after finalize: clearing price, tokens sold, tokens burned (tokenSupply - tokensSold),
   the token's current totalSupply, and proceeds waiting for the seller.
6. An activity feed of BidPlaced, AuctionCleared, AuctionFinalized, Claimed and RefundDeferred events, newest first.
```

### F6: Seller panel

**Context:** `FRONTEND_SPEC.md`, the F3 output

```text
Build SellerPanel, rendered only when the connected account equals seller() (compare addresses
case-insensitively). It contains:
- Start auction: enabled only when startTime == 0.
- Withdraw proceeds: enabled only when finalized and proceeds > 0. Show the amount.
- Settle all bidders: read every bidder from BidPlaced events and call claimFor for each one that still
  has a bid or excess, one transaction at a time with progress shown.
Hiding the panel is a UX nicety, not security. Say so in a code comment, and explain how the contract
itself enforces seller-only actions.
```

### F7: Transaction status and error decoding

**Context:** `contracts/IDutchAuction.sol`, all components so far

```text
Add one transaction helper used by every write action:
- States: waiting for wallet, then pending (with tx hash), then confirmed (block number), or failed.
- Show these as toasts or an inline status line.
- Decode custom errors from the DutchAuction ABI (ethers v6) and map each one in IDutchAuction.sol
  (NotSeller, AuctionNotActive, NothingToClaim, ...) to a plain-English message.
- Handle the user rejecting the request in MetaMask (code 4001 / ACTION_REJECTED) separately from reverts.
- Disable a button while its transaction is pending, to prevent double submits.
Then refactor every component to use the helper.
```

### F8: UI design pass

**Context:** the whole `frontend/src/`

```text
Do a visual design pass. The rubric rewards "sleek UX". Keep all behaviour unchanged.
- A clear layout: header (wallet), hero (status badge, price, countdown, chart), a two-column body
  (bid and position | progress and activity), seller panel, results.
- A consistent palette with CSS variables, readable typography, a colour-coded status badge,
  and loading skeletons instead of empty values.
- Responsive down to 375px wide, visible focus states, sufficient contrast.
- Numbers formatted consistently (ETH to 4 decimals, tokens to 2), with full precision in a tooltip.
List what you changed. Don't add new dependencies without asking.
```

### F9: README and run guide

**Context:** `README.md` (currently the Hardhat 3 sample), `package.json`, `FRONTEND_SPEC.md`, `DESIGN.md` §13

```text
Rewrite README.md for this project. It currently describes a Hardhat 3 sample, which is wrong
(this is Hardhat 2 with no Ignition and no Sepolia). Include: what the project is, the repo layout,
prerequisites (Node version, MetaMask), install, test, run the local node, deploy or seed, connect MetaMask
to 31337 and import test accounts, start the frontend, the full demo walkthrough (DESIGN.md §13),
how to fast-forward time, troubleshooting (MetaMask nonce errors after a node restart, wrong network,
stale contracts.json), and links to SPEC.md, DESIGN.md and AI_AUDIT.md.
Give commands for Windows PowerShell and for bash.
```

---

## Phase 2: Find bugs

Start a **new session** for this phase. Bugs found here go into `AI_AUDIT.md` §5 as ISSUE-006 onwards.

### R1: Spec-conformance review (no fixes)

**Context:** `FRONTEND_SPEC.md`, `DESIGN.md`, `contracts/DutchAuction.sol`, the whole `frontend/src/`

```text
You are reviewing code written by another AI. Do NOT fix anything yet.
Check the frontend against FRONTEND_SPEC.md and the contract, requirement by requirement. For each one,
reply PASS / FAIL / PARTIAL with file:line evidence.
Then list every defect you find as:
  ID | severity (High/Med/Low) | file:line | what is wrong | user-visible impact | how to reproduce by hand
Be concrete. If you are unsure, say "suspected" and give the reproduction step that would confirm it.
Don't report style preferences as defects.
```

### R2: Maths and time consistency audit

**Context:** `contracts/DutchAuction.sol`, `frontend/src/lib/auctionMath.js`, `useAuction`, `BidForm`, `MyPosition`, `ResultsPanel`

```text
For every number the UI shows, trace it back to the contract formula and check it matches exactly,
including rounding direction and units. Specifically:
1. Is any wei value ever converted to a JavaScript Number or float? List every place.
2. Where does "now" come from for the countdown and the price? Will the UI and the contract disagree on
   a Hardhat node where time only advances on new blocks, or after evm_increaseTime?
3. Do estimated tokens, maxCommit, tokens remaining, tokensFor, refundFor and tokens burned match the
   Solidity formulas (multiply before divide, floor vs ceil)?
4. Does the status logic match the contract's revert conditions exactly (e.g. the "demand already meets
   supply" case where bid() reverts even though soldOut is false)?
For each mismatch: the UI formula, the contract formula, and an example input where they differ.
```

### R3: Wallet, network and state edge cases

**Context:** `WalletProvider`, `useWallet`, `useAuction`, `frontend/src/lib/contract.js`

```text
Find bugs in wallet and provider state handling. Check each scenario, and say what the code does now and
what it should do:
- MetaMask not installed; user rejects the connection; user locks MetaMask while connected.
- Switching account while a transaction is pending; switching account after finalize (stale position shown?).
- Switching to another network and back.
- Hardhat node restarted and contracts redeployed, but the page not refreshed; contracts.json out of date.
- Two browser tabs open at once.
- Event listeners or polling intervals not cleaned up (memory leaks, duplicate refreshes).
- Using a signer where only a provider is needed, or the other way round.
Give file:line for each finding.
```

### R4: Role and action guarding

**Context:** `SellerPanel`, `BidForm`, the settlement components, `contracts/DutchAuction.sol`, `contracts/IDutchAuction.sol`

```text
For every write action (start, bid, finalize, claim, claimFor, withdrawRefund, withdrawProceeds), make a table:
action | contract revert conditions | conditions the UI uses to enable the button | gaps
A "gap" means the UI enables a button that will revert, or disables a button that would succeed.
Also check: are the seller-only controls hidden for non-sellers, and is the address comparison
case-insensitive? Is every custom error in IDutchAuction.sol mapped to a readable message?
```

### R5: Frontend security review

**Context:** the whole `frontend/`, `frontend/package.json`, `.gitignore`

```text
Do a security review of the frontend:
- Are any secrets, private keys or mnemonics in the code, config or committed files?
- Is user-controlled or event data rendered unsafely (dangerouslySetInnerHTML, unescaped addresses)?
- Could a transaction send a different value or call a different function than the UI shows?
- Is the user always told the chain id and contract address before signing?
- Are dependencies pinned, and are there known-vulnerable packages (tell me to run `npm audit`)?
- Does .gitignore exclude frontend/node_modules, frontend/dist and .env files?
Report findings in the same table format as R1.
```

### R6: Unit tests for the frontend maths

**Context:** `frontend/src/lib/auctionMath.js`, `contracts/DutchAuction.sol`, `DESIGN.md` §5 to §7

```text
Write Vitest unit tests for frontend/src/lib/auctionMath.js. Cover: price at t=0, at 10 min, at 20 min and after
the end; status derivation for every status; estimated tokens for 1 wei and for amounts that don't
divide evenly; maxCommit and tokens remaining; the partial-fill warning threshold; tokensFor and refundFor
after finalize, compared with the Solidity formulas using the demo parameters
(1000 tokens, 1 ETH down to 0.1 ETH). Add an "npm test" script in frontend/package.json.
Do not change auctionMath.js. If a test fails, report it as a bug rather than adjusting the expectation.
```

> Save the output: `cd frontend; npm test 2>&1 | Out-File -Encoding utf8 ..\audit\frontend-test-output.txt`

### Manual end-to-end test (done by you, not by the AI)

Run it with 3 MetaMask accounts plus the seller. Screenshot each step into `audit/screenshots/`, and note anything wrong.

1. `npx hardhat node`, deploy (not seed), import 4 test accounts, connect.
2. Before start: status shows Not started, bid is disabled, only the seller sees Start.
3. Start. The price falls and the countdown runs. Check the UI price against `currentPrice()` in the Hardhat console.
4. Three bids at different times. Committed and remaining update. The partial-fill warning appears on the crossing bid.
5. Sold out: bidding is disabled and the clearing price is shown.
6. Finalize from a non-seller account. Results show sold and burned, and the token supply has dropped.
7. Each account claims. Check the tokens and refund against `tokensFor` and `refundFor` before claiming.
8. claimFor on a bidder who has not claimed. Then the seller withdraws proceeds, and the contract balance ends at 0.
9. Second run: let time expire without a sell-out (`evm_increaseTime 1200` then `evm_mine`), and check the reserve price and burn.
10. Edge cases: wrong network, account switch mid-auction, rejecting a transaction, double-clicking a button, restarting the node.

### R7: Root-cause analysis for each confirmed bug

**Context:** the buggy code snippet, the screenshot or console error, the relevant spec section

```text
This bug was confirmed by [R1 review / manual test step N / unit test]:
  Observed: <what happened>
  Expected: <what the spec or contract says>
  Evidence: <console error / screenshot description / failing test output>
Explain, without fixing it yet:
1. The exact root cause, with file:line.
2. Why an AI code generator is likely to have produced this, e.g. missing context, a wrong assumption about
   the provider or the chain clock, or copying a common tutorial pattern.
3. The real-world impact for a user of this dApp.
```

### R8: Fix each bug

**Context:** the R7 analysis and the affected files

```text
Fix <ISSUE-0XX: title> with the smallest change that resolves the root cause from the analysis.
- Don't refactor unrelated code.
- Add or update a unit test that fails before the fix and passes after it, if the logic is testable.
  Otherwise, give me the exact manual steps that show it is fixed.
- Show the diff and explain it in 2 or 3 sentences for the audit report.
```

> One commit per fix: `Fix ISSUE-0XX: <title>`. Take before and after screenshots.

### R9: Re-review after the fixes

**Context:** the R1 findings list, the current `frontend/src/`

```text
Here is the original defect list from the review, and the current code. For each defect, state: fixed /
not fixed / partly fixed, with file:line evidence. Then check whether any fix introduced a new problem,
especially in status logic, BigInt maths, or wallet state.
```

### A1: Draft the audit entries (you check every fact)

**Context:** your notes, the R7 analysis, the commit hashes, the test output, the screenshot filenames

```text
Turn these notes into AI_AUDIT.md entries in the existing format: an ISSUE section using the four-part
breakdown from §5.3 (why the AI made the mistake, why it is problematic, how it was fixed, evidence), plus
rows for the §5.1 inventory and §7. Use ONLY the facts in my notes. Where something is missing,
write TODO rather than inventing a date, a hash or a test result.
```

---

## Commit plan

| Order | Commit message |
|---|---|
| 1 | `Frontend spec (before AI code)` |
| 2 | `AI first draft frontend (unreviewed)` (the F1 to F7 output, untouched) |
| 3 | `Frontend design pass` (F8) |
| 4 | `Frontend unit tests` (R6) |
| 5+ | `Fix ISSUE-0XX: <title>`, one per bug |
| last | `README and audit: frontend sections` |

> If you would rather commit after each F prompt, tag the last commit before your own review as the "first draft".

## Prompt log (fill in as you go, then copy to AI_AUDIT.md §3.2)

| Audit # | Prompt | Date | Tool / model | Output | Kept / changed / issues found |
|---|---|---|---|---|---|
| P4 | F0 spec | | | | |
| P5 | F1 scaffold | | | | |
| P6 | F2 wallet | | | | |
| P7 | F3 state hook | | | | |
| P8 | F4 bidder view | | | | |
| P9 | F5 settlement | | | | |
| P10 | F6 seller panel | | | | |
| P11 | F7 tx and errors | | | | |
| P12 | F8 design | | | | |
| P13 | R1 review | | | | |
| P14 | R2 maths and time | | | | |
| P15 | R3 wallet edge cases | | | | |
| P16 | R4 action guards | | | | |
| P17 | R5 security | | | | |
| P18 | R6 unit tests | | | | |
| P19+ | R7 and R8 per issue, R9 re-review | | | | |
