// Chain clock for the UI (FRONTEND_SPEC.md §6, fixed in ISSUE-006).
//
// A Hardhat node (and any real chain between blocks) only moves block.timestamp when a block is
// mined; the next block gets the wall-clock time plus any evm_increaseTime offset. The price a bid
// pays is set by the block it is mined in, so the UI must show "latest block time + time elapsed
// since that block was first seen". The anchor may only move when a NEW block appears: re-anchoring
// the same block on every poll resets the elapsed time to zero and freezes the clock.

/** Returns the anchor to use after seeing `block` at local time `localMs`. */
export function nextAnchor(prev, block, localMs) {
  if (prev && prev.blockNumber === block.number) return prev; // same block: keep counting from first sight
  return { blockNumber: block.number, chainTs: BigInt(block.timestamp), localMs };
}

/** Estimated chain time (seconds, BigInt) for the next block at local time `localMs`. */
export function chainNow(anchor, localMs) {
  if (!anchor) return 0n;
  const elapsed = Math.max(0, Math.floor((localMs - anchor.localMs) / 1000));
  return anchor.chainTs + BigInt(elapsed);
}
