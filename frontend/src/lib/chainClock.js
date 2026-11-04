// Chain clock for the UI (FRONTEND_SPEC.md §6; ISSUE-006 and ISSUE-011).
//
// The price a bid pays is set by the block it is mined in, so the UI needs the timestamp the NEXT
// block will get: on a Hardhat node that is the wall-clock time plus any evm_increaseTime offset.
//
// Preferred source: the node's "pending" block, whose timestamp is exactly that value and moves
// continuously, so re-anchoring on it every poll is correct.
// Fallback (node without "pending"): the latest block, anchored when it is FIRST seen and only
// moved when a new block appears. Re-anchoring the same block each poll froze the clock
// (ISSUE-006); anchoring an old block at page-load time made the clock lag by the block's age
// (ISSUE-011), which is why the pending block is preferred.

/**
 * @param prev       previous anchor or null
 * @param latest     { number, timestamp } of the latest block
 * @param pendingTs  timestamp of the pending block, or null/undefined if the node does not provide it
 * @param localMs    Date.now() when these values were fetched
 */
export function nextAnchor(prev, latest, pendingTs, localMs) {
  if (pendingTs !== null && pendingTs !== undefined) {
    return { source: "pending", blockNumber: latest.number, chainTs: BigInt(pendingTs), localMs };
  }
  if (prev && prev.source === "latest" && prev.blockNumber === latest.number) return prev;
  return { source: "latest", blockNumber: latest.number, chainTs: BigInt(latest.timestamp), localMs };
}

/** Estimated chain time (seconds, BigInt) for the next block at local time `localMs`. */
export function chainNow(anchor, localMs) {
  if (!anchor) return 0n;
  const elapsed = Math.max(0, Math.floor((localMs - anchor.localMs) / 1000));
  return anchor.chainTs + BigInt(elapsed);
}
