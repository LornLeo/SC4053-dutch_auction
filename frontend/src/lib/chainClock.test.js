// Regression tests for the chain clock: ISSUE-006 (froze between blocks) and ISSUE-011 (lagged
// after a page load when the latest block was old).
import { describe, expect, it } from "vitest";
import { chainNow, nextAnchor } from "./chainClock.js";

const block = (number, timestamp) => ({ number, timestamp });

describe("chain clock: latest-block fallback (ISSUE-006)", () => {
  it("keeps advancing across polls that return the same latest block", () => {
    let anchor = nextAnchor(null, block(2, 1_000), null, 0);
    // The draft re-anchored here on every 2-second poll, so elapsed time never exceeded ~2 s.
    for (let t = 2_000; t <= 26_000; t += 2_000) anchor = nextAnchor(anchor, block(2, 1_000), null, t);
    expect(chainNow(anchor, 26_000)).toBe(1_026n);
  });

  it("re-anchors when a new block appears, including a jump from evm_increaseTime", () => {
    let anchor = nextAnchor(null, block(5, 1_000), null, 0);
    anchor = nextAnchor(anchor, block(6, 1_700), null, 3_000);
    expect(chainNow(anchor, 3_000)).toBe(1_700n);
    expect(chainNow(anchor, 8_500)).toBe(1_705n);
  });
});

describe("chain clock: pending block (ISSUE-011)", () => {
  it("uses the node's pending timestamp, not the age of the latest block", () => {
    // Page opened 99 s after the latest block was mined. The ISSUE-006 fix alone showed 1_000 here,
    // a price 99 s too high, and the bid estimate was off by ~74 ETH.
    const anchor = nextAnchor(null, block(5, 1_000), 1_099, 50_000);
    expect(chainNow(anchor, 50_000)).toBe(1_099n);
    expect(chainNow(anchor, 53_000)).toBe(1_102n);
  });

  it("follows evm_increaseTime without a new block", () => {
    let anchor = nextAnchor(null, block(5, 1_000), 1_010, 0);
    anchor = nextAnchor(anchor, block(5, 1_000), 1_112, 2_000); // +100 s offset, 2 s later
    expect(chainNow(anchor, 2_000)).toBe(1_112n);
  });
});

describe("chainNow", () => {
  it("never runs backwards if the local clock does, and is 0 before the first poll", () => {
    const anchor = nextAnchor(null, block(1, 500), null, 10_000);
    expect(chainNow(anchor, 9_000)).toBe(500n);
    expect(chainNow(null, 123)).toBe(0n);
  });
});
