// Pure auction maths, mirroring contracts/DutchAuction.sol exactly (BigInt only, same rounding).
// Kept free of React and ethers so it can be unit tested. Spec: FRONTEND_SPEC.md §4 and §7.

export const DURATION = 1200n; // 20 minutes, DutchAuction.DURATION
export const UNIT = 10n ** 18n; // 1 whole token in base units

export const Status = {
  NOT_STARTED: "Not started",
  ACTIVE: "Active",
  DEMAND_MET: "Demand met",
  SOLD_OUT: "Sold out",
  ENDED: "Ended",
  FINALIZED: "Finalized",
};

/** Price in wei per whole token at chain time `now` (seconds, BigInt). Same as currentPrice(). */
export function priceAt(a, now) {
  if (a.startTime === 0n) return a.startPrice;
  if (now >= a.endTime) return a.reservePrice;
  const elapsed = now > a.startTime ? now - a.startTime : 0n;
  return a.startPrice - ((a.startPrice - a.reservePrice) * elapsed) / DURATION;
}

/** ETH (wei) needed to buy the whole supply at `price`. */
export function maxCommitAt(a, price) {
  return (a.tokenSupply * price) / UNIT;
}

/** ETH still accepted before the auction sells out at `price`. */
export function remainingEthAt(a, price) {
  const max = maxCommitAt(a, price);
  return max > a.totalCommitted ? max - a.totalCommitted : 0n;
}

/** Token base units bought by `eth` wei at `price` (rounds down, like the contract). */
export function tokensForEth(eth, price) {
  if (price === 0n) return 0n;
  return (eth * UNIT) / price;
}

/** What happens to a bid of `amount` wei at `price`, before the final clearing price is known. */
export function bidEstimate(a, amount, price) {
  const remaining = remainingEthAt(a, price);
  const accepted = amount < remaining ? amount : remaining;
  return {
    accepted,
    refundable: amount - accepted,
    tokens: tokensForEth(accepted, price),
    partial: amount >= remaining,
  };
}

/** Auction status at chain time `now`, checked in the order of FRONTEND_SPEC.md §4. */
export function deriveStatus(a, now) {
  if (a.startTime === 0n) return Status.NOT_STARTED;
  if (a.finalized) return Status.FINALIZED;
  if (a.soldOut) return Status.SOLD_OUT;
  if (now >= a.endTime) return Status.ENDED;
  if (a.totalCommitted >= maxCommitAt(a, priceAt(a, now))) return Status.DEMAND_MET;
  return Status.ACTIVE;
}

/** Seconds left until endTime (full duration before start). Matches timeRemaining(). */
export function timeLeft(a, now) {
  if (a.startTime === 0n) return DURATION;
  return now >= a.endTime ? 0n : a.endTime - now;
}

/** Progress of committed ETH against maxCommit, in basis points (0..10000). */
export function progressBps(a, price) {
  const max = maxCommitAt(a, price);
  if (max === 0n) return 0;
  const bps = (a.totalCommitted * 10000n) / max;
  return Number(bps > 10000n ? 10000n : bps);
}

/** Claim preview, same as tokensFor()/refundFor() in the contract. */
export function claimPreview(committed, excess, clearingPrice) {
  if (clearingPrice === 0n) return { tokens: 0n, cost: 0n, refund: 0n };
  const tokens = (committed * UNIT) / clearingPrice;
  const cost = (tokens * clearingPrice) / UNIT;
  return { tokens, cost, refund: committed - cost + excess };
}

export const canFinalize = (status) => status === Status.SOLD_OUT || status === Status.ENDED;

/** True while bids can still change the outcome. */
export const biddingOpen = (status) => status === Status.NOT_STARTED || status === Status.ACTIVE;

/**
 * Clearing price that finalize() sets (DESIGN.md §6): the crossing price if sold out, otherwise
 * max(reservePrice, ceil(totalCommitted * 1e18 / tokenSupply)). Added for ISSUE-008.
 */
export function expectedClearingPrice(a) {
  if (a.soldOut || a.finalized) return a.clearingPrice;
  const implied = (a.totalCommitted * UNIT + a.tokenSupply - 1n) / a.tokenSupply;
  return implied > a.reservePrice ? implied : a.reservePrice;
}

/**
 * The price the UI headlines (ISSUE-008): the live falling price while bids are possible, and the
 * fixed (or already-determined) clearing price once bidding is over.
 */
export function displayPrice(a, now, status) {
  return biddingOpen(status) ? priceAt(a, now) : expectedClearingPrice(a);
}
