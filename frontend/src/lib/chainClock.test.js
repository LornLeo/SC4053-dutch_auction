// ISSUE-006 regression tests: the countdown and price froze while no new block was mined.
import { describe, expect, it } from "vitest";
import { chainNow, nextAnchor } from "./chainClock.js";

const block = (number, timestamp) => ({ number, timestamp });

describe("chain clock (ISSUE-006)", () => {
  it("keeps advancing across polls that return the same latest block", () => {
    let anchor = nextAnchor(null, block(2, 1_000), 0);
    // The draft re-anchored here on every 2-second poll, so elapsed time never exceeded ~2 s.
    for (let t = 2_000; t <= 26_000; t += 2_000) anchor = nextAnchor(anchor, block(2, 1_000), t);
    expect(chainNow(anchor, 26_000)).toBe(1_026n);
  });

  it("re-anchors when a new block appears, including a time jump from evm_increaseTime", () => {
    let anchor = nextAnchor(null, block(5, 1_000), 0);
    anchor = nextAnchor(anchor, block(6, 1_700), 3_000);
    expect(chainNow(anchor, 3_000)).toBe(1_700n);
    expect(chainNow(anchor, 8_500)).toBe(1_705n);
  });

  it("never runs backwards if the local clock does", () => {
    const anchor = nextAnchor(null, block(1, 500), 10_000);
    expect(chainNow(anchor, 9_000)).toBe(500n);
  });

  it("is 0 before the first block is seen", () => {
    expect(chainNow(null, 123)).toBe(0n);
  });
});
