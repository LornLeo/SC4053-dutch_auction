# Frontend end-to-end test notes (Role C)

Manual and scripted UI testing for `AI_AUDIT.md` §6.3. Every number below was read from the running app
or from the local node during the session on 2026-11-04.

**Setup:** `npx hardhat node`, `npx hardhat run scripts/deploy.js --network localhost`, `cd frontend && npm run dev`,
opened in the Claude desktop app's built-in browser. Transactions were signed with the node's **local test
accounts** (the header dropdown, FRONTEND_SPEC.md §3.2), because MetaMask is not available in that browser.
Some steps were driven by a short in-page script that types into the inputs and clicks the buttons, so
measurements could be repeated.

> **Not covered here: the MetaMask path** (connect, network switch banner, `accountsChanged` / `chainChanged`,
> rejecting a signature, which should show "Cancelled in wallet."). C must run steps 1 to 10 of the checklist in
> `audit/frontend-prompts.md` once with MetaMask and save screenshots to `audit/screenshots/`. The error-decoding and
> "cancelled" logic is unit tested (`frontend/src/lib/format.test.js`) but not yet seen in a real wallet.

## Run 1: AI first draft (commit `a3f5509`)

| Step | Result | Issue |
|---|---|---|
| Page without a wallet | Live auction data shown; Not started; bid disabled | OK |
| Seller (#0) Start | Status Active, but **countdown stayed 20:00 and price 1.0000 ETH**. Node: block 2 was 26 s old (`latest` ts 1793767647, wall 1793767673) | ISSUE-006 |
| Alice (#1) bids 300 ETH | Bid mined in block 3. The UI jumped to 19:05 / 0.9587 only when that block appeared | ISSUE-006 |
| Toast after a bid | Still "Pending…" 4 s after the click although the data had updated; confirmed by ~7 s | ISSUE-007 |
| Account switch | Needed Disconnect, then pick another account (slow during a demo) | Fixed in F8 |
| Crossing bid 600 ETH (#4) | Form estimated **372 ETH accepted / 228 refundable** at 0.9220; actual `BidPlaced`: **345.75 accepted / 254.25 refundable at 0.8957** | ISSUE-006 |
| After sell-out | Status Sold out, but hero still showed a falling "current price" (0.8950) and a running countdown | ISSUE-008 |
| Finalize from non-seller (#4) | Works. Results: clearing 0.8957, sold 1,000, burned 0 | OK |
| After finalize | "Time left 17:21" and Demand "sells out at 880.75 ETH" kept changing | ISSUE-008 |
| Claim (#4) | Preview "385.98 AUC + 254.2500 ETH". On chain: 385989394362266257326 AUC units and 254250000000000000001 wei (+1 wei rounding dust, as DESIGN.md §7 predicts) | OK |
| `claimFor` Alice from #4 | Alice receives 334.91 AUC | OK |
| Click Settle again for Alice | Button still enabled; tx reverted, toast "Nothing to claim for this address." (decoder works) | ISSUE-009 |
| Seller: Settle all, Withdraw | "Settled 1 of 1"; seller withdrew 895.7499 ETH; **contract balance 0 wei** | OK |
| Lazy clear (500 ETH, +700 s) | Status "Demand met" with the correct hint; finalize disabled | OK |
| … then +600 s (Ended) | Hero headlined **0.1000** (reserve); finalize then cleared at **0.5000** | ISSUE-008 |
| Never sells out (50 ETH) | Clearing 0.1, sold 500, **burned 500, total supply 500** | OK |
| `hardhat_reset` (no contract) | Banner "No contract at 0x0165…Eb8F on this chain. Run …deploy.js" | OK |
| Node stopped | Banner showed raw **"server response 500 Internal Server Error"** | ISSUE-010 |
| Phone width 375 px | Two-column grid did not collapse; Bid button overlapped the Demand card | Fixed in F8 |

## Run 2: after the fixes (commit `03d7367`)

| Step | Result |
|---|---|
| Start, then 12 s with no new block (block stayed 2) | UI went 19:59 / 0.9992 → 19:46 / 0.9895 (13 s × 0.00075 ETH): ISSUE-006 fixed |
| Toast timing, same 10 ETH bid | click → "Confirmed": **4406 ms** with 4 s polling, **415 ms** with 1 s polling: ISSUE-007 fixed |
| Reload page well after the last block, crossing bid | **Regression found:** estimate 920.75 accepted at 0.9407, actual 846.5 at 0.8665. The 0.0742 ETH gap ÷ 0.00075 ETH/s ≈ 99 s of lag → ISSUE-011 |
| After ISSUE-011 fix: reload 40 s after the last block, crossing bid | estimate 656.50 at 0.9565, actual 655.75 at 0.9557 (one second of decay) |
| Sold out | Hero "Clearing price 0.8665 · Bidding Closed": ISSUE-008 fixed |
| Settle Alice via the form | Settle enabled before, disabled with "Nothing left to settle" after: ISSUE-009 fixed |
| Node stopped | "Cannot reach the local Hardhat node. Start it with npx hardhat node.": ISSUE-010 fixed |
| **Full demo on a fresh node** | Not started → seller-only Start (panel hidden for #1) → Active 19:59 → bids 300 + 250 → after 5 s idle 19:45 → crossing 600: estimate 436.50 accepted, actual 435.75 at 0.9857 → Sold out, Clearing price, Closed → finalize by #3 → claim preview "442.04 AUC + 164.2500 ETH" equals the `Claimed` event → claimFor Alice 304.33 AUC → seller Settle all (1 of 1) → seller withdrew 985.7499 ETH → **contract 0 wei** |

## Automated evidence

`audit/frontend-test-output.txt`: 37 Vitest tests (maths, chain clock, formatting, error decoding) and
`test/FrontendParity.test.js` (5 tests running the UI maths against the deployed contract), plus the existing
contract suites (19 passing in total).
