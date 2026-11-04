// R6: unit tests for the frontend maths against the Solidity formulas (DESIGN.md §5-7).
// Demo parameters: 1000 tokens, 1 ETH -> 0.1 ETH over 1200 s. Expected values are worked out by hand
// from the contract's integer formulas, or taken from a recorded on-chain run (noted where used).
import { describe, expect, it } from "vitest";
import {
  Status,
  bidEstimate,
  canFinalize,
  claimPreview,
  deriveStatus,
  displayPrice,
  expectedClearingPrice,
  maxCommitAt,
  priceAt,
  progressBps,
  remainingEthAt,
  timeLeft,
  tokensForEth,
} from "./auctionMath.js";

const E = (n) => BigInt(Math.round(n * 1e6)) * 10n ** 12n; // ETH -> wei for short decimals
const START = 1_000n;
const base = {
  startPrice: E(1),
  reservePrice: E(0.1),
  tokenSupply: E(1000),
  startTime: START,
  endTime: START + 1200n,
  totalCommitted: 0n,
  soldOut: false,
  finalized: false,
};
const auction = (patch = {}) => ({ ...base, ...patch });

describe("priceAt (DESIGN.md §5)", () => {
  it("returns startPrice before start()", () => {
    expect(priceAt(auction({ startTime: 0n, endTime: 0n }), 5_000n)).toBe(E(1));
  });
  it("is startPrice at t = 0", () => {
    expect(priceAt(auction(), START)).toBe(E(1));
  });
  it("drops 0.00075 ETH per second", () => {
    expect(priceAt(auction(), START + 1n)).toBe(999_250_000_000_000_000n);
  });
  it("is 0.55 ETH at 10 minutes", () => {
    expect(priceAt(auction(), START + 600n)).toBe(E(0.55));
  });
  it("is the reserve at 20 minutes and after", () => {
    expect(priceAt(auction(), START + 1200n)).toBe(E(0.1));
    expect(priceAt(auction(), START + 99_999n)).toBe(E(0.1));
  });
  it("never goes above startPrice for a clock slightly behind startTime", () => {
    expect(priceAt(auction(), START - 5n)).toBe(E(1));
  });
});

describe("supply maths", () => {
  it("maxCommit = supply * price / 1e18", () => {
    expect(maxCommitAt(auction(), E(0.55))).toBe(E(550));
  });
  it("remaining ETH is clamped at zero", () => {
    expect(remainingEthAt(auction({ totalCommitted: E(500) }), E(0.55))).toBe(E(50));
    expect(remainingEthAt(auction({ totalCommitted: E(600) }), E(0.55))).toBe(0n);
  });
  it("tokensForEth rounds down like the contract", () => {
    expect(tokensForEth(1n, E(0.55))).toBe(1n); // 1.81 base units -> 1
    expect(tokensForEth(E(1), E(0.3))).toBe(3_333_333_333_333_333_333n);
    expect(tokensForEth(E(1), 0n)).toBe(0n);
  });
  it("progress is in basis points and capped at 100%", () => {
    expect(progressBps(auction({ totalCommitted: E(275) }), E(0.55))).toBe(5000);
    expect(progressBps(auction({ totalCommitted: E(900) }), E(0.55))).toBe(10000);
  });
});

describe("bidEstimate (crossing bid, DESIGN.md §6 step 6)", () => {
  const a = auction({ totalCommitted: E(500) });
  it("accepts a bid below the sell-out amount in full", () => {
    expect(bidEstimate(a, E(10), E(0.55))).toEqual({
      accepted: E(10),
      refundable: 0n,
      tokens: tokensForEth(E(10), E(0.55)),
      partial: false,
    });
  });
  it("splits a crossing bid into accepted and refundable", () => {
    const est = bidEstimate(a, E(60), E(0.55));
    expect(est.accepted).toBe(E(50));
    expect(est.refundable).toBe(E(10));
    expect(est.partial).toBe(true);
  });
  it("treats an exact fill as the sell-out bid (contract uses >=) with nothing refundable", () => {
    const est = bidEstimate(a, E(50), E(0.55));
    expect(est.partial).toBe(true);
    expect(est.refundable).toBe(0n);
  });
});

describe("deriveStatus (FRONTEND_SPEC.md §4)", () => {
  it("covers every status in priority order", () => {
    expect(deriveStatus(auction({ startTime: 0n, endTime: 0n }), 0n)).toBe(Status.NOT_STARTED);
    expect(deriveStatus(auction(), START + 10n)).toBe(Status.ACTIVE);
    // 500 ETH committed; at 700 s the price is 0.475 so 500 ETH already buys the supply.
    expect(deriveStatus(auction({ totalCommitted: E(500) }), START + 700n)).toBe(Status.DEMAND_MET);
    expect(deriveStatus(auction({ soldOut: true }), START + 10n)).toBe(Status.SOLD_OUT);
    expect(deriveStatus(auction(), START + 1200n)).toBe(Status.ENDED);
    expect(deriveStatus(auction({ soldOut: true, finalized: true }), START + 10n)).toBe(Status.FINALIZED);
  });
  it("only Sold out and Ended allow finalize()", () => {
    expect(canFinalize(Status.SOLD_OUT)).toBe(true);
    expect(canFinalize(Status.ENDED)).toBe(true);
    expect(canFinalize(Status.DEMAND_MET)).toBe(false);
    expect(canFinalize(Status.ACTIVE)).toBe(false);
    expect(canFinalize(Status.FINALIZED)).toBe(false);
  });
});

describe("expectedClearingPrice / displayPrice (ISSUE-008)", () => {
  it("uses the crossing price once sold out", () => {
    const a = auction({ soldOut: true, clearingPrice: E(0.89575), totalCommitted: E(895.75) });
    expect(expectedClearingPrice(a)).toBe(E(0.89575));
    expect(displayPrice(a, START + 100n, Status.SOLD_OUT)).toBe(E(0.89575));
  });
  it("rounds the implied price up after a lazy clear (500 ETH for 1000 tokens -> 0.5)", () => {
    const a = auction({ totalCommitted: E(500), clearingPrice: 0n });
    expect(expectedClearingPrice(a)).toBe(E(0.5));
    expect(expectedClearingPrice(auction({ totalCommitted: 1n, clearingPrice: 0n, reservePrice: 1n }))).toBe(1n);
    // The draft headlined the falling live price (0.1 ETH at the end) instead of 0.5.
    expect(displayPrice(a, START + 1200n, Status.ENDED)).toBe(E(0.5));
    expect(displayPrice(a, START + 700n, Status.DEMAND_MET)).toBe(E(0.5));
  });
  it("falls back to the reserve when the auction never sold out", () => {
    const a = auction({ totalCommitted: E(50), clearingPrice: 0n });
    expect(displayPrice(a, START + 1300n, Status.ENDED)).toBe(E(0.1));
  });
  it("shows the live price while bidding is open", () => {
    expect(displayPrice(auction(), START + 600n, Status.ACTIVE)).toBe(E(0.55));
  });
});

describe("timeLeft", () => {
  it("is the full duration before start and zero after the end", () => {
    expect(timeLeft(auction({ startTime: 0n, endTime: 0n }), 0n)).toBe(1200n);
    expect(timeLeft(auction(), START + 100n)).toBe(1100n);
    expect(timeLeft(auction(), START + 5000n)).toBe(0n);
  });
});

describe("claimPreview = tokensFor / refundFor (DESIGN.md §7)", () => {
  it("matches the recorded on-chain claim from the manual E2E run", () => {
    // Account #4 committed 345.75 ETH (+254.25 ETH excess); the auction cleared at 0.89575 ETH.
    // On chain it received 385989394362266257326 AUC base units and 254250000000000000001 wei.
    const p = claimPreview(345_750_000_000_000_000_000n, 254_250_000_000_000_000_000n, 895_750_000_000_000_000n);
    expect(p.tokens).toBe(385_989_394_362_266_257_326n);
    expect(p.refund).toBe(254_250_000_000_000_000_001n);
  });
  it("conserves wei: cost + refund == bids + excess", () => {
    const bids = 123_456_789_012_345_678_901n;
    const excess = 7n;
    const p = claimPreview(bids, excess, 333_333_333_333_333_333n);
    expect(p.cost + p.refund).toBe(bids + excess);
  });
  it("is zero before a clearing price exists", () => {
    expect(claimPreview(E(1), 0n, 0n)).toEqual({ tokens: 0n, cost: 0n, refund: 0n });
  });
});
