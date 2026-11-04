import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG, auctionIface, readAuction, readProvider, readToken } from "../lib/contract.js";
import {
  deriveStatus,
  displayPrice,
  maxCommitAt,
  priceAt,
  progressBps,
  remainingEthAt,
  timeLeft,
  tokensForEth,
} from "../lib/auctionMath.js";
import { chainNow, nextAnchor } from "../lib/chainClock.js";
import { isNodeUnreachable } from "../lib/errors.js";

const POLL_MS = 2000;

// Timestamp the next block will get (ISSUE-011); null if the node has no "pending" block.
async function pendingTimestamp() {
  try {
    const b = await readProvider.send("eth_getBlockByNumber", ["pending", false]);
    return b?.timestamp ? Number(b.timestamp) : null;
  } catch {
    return null;
  }
}

/**
 * Everything the UI needs about the auction and the connected account (FRONTEND_SPEC.md §4, §6, §7).
 * State model: one snapshot of on-chain values, refreshed every 2 s and after each transaction; derived
 * values (price, status, countdown) are recomputed every second from chain time, anchored on the
 * latest block's timestamp, never from the browser clock alone.
 */
export function useAuction(account) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);
  const anchor = useRef(null); // { source, blockNumber, chainTs: BigInt, localMs } — see lib/chainClock.js

  const refresh = useCallback(async () => {
    try {
      const code = await readProvider.getCode(CONFIG.auction.address);
      if (code === "0x") {
        setError("not-deployed");
        setSnapshot(null);
        return;
      }
      const [
        block,
        startTime,
        endTime,
        startPrice,
        reservePrice,
        tokenSupply,
        totalCommitted,
        soldOut,
        finalized,
        clearingPrice,
        tokensSold,
        proceeds,
        seller,
        tokenTotalSupply,
        contractEth,
        logs,
        pendingTs,
      ] = await Promise.all([
        readProvider.getBlock("latest"),
        readAuction.startTime(),
        readAuction.endTime(),
        readAuction.startPrice(),
        readAuction.reservePrice(),
        readAuction.tokenSupply(),
        readAuction.totalCommitted(),
        readAuction.soldOut(),
        readAuction.finalized(),
        readAuction.clearingPrice(),
        readAuction.tokensSold(),
        readAuction.proceeds(),
        readAuction.seller(),
        readToken.totalSupply(),
        readProvider.getBalance(CONFIG.auction.address),
        readProvider.getLogs({ address: CONFIG.auction.address, fromBlock: CONFIG.deployBlock, toBlock: "latest" }),
        pendingTimestamp(),
      ]);

      let me = null;
      if (account) {
        const [bids, excess, tokensFor, refundFor, pendingRefund, eth, auc] = await Promise.all([
          readAuction.bids(account),
          readAuction.excess(account),
          readAuction.tokensFor(account),
          readAuction.refundFor(account),
          readAuction.pendingRefund(account),
          readProvider.getBalance(account),
          readToken.balanceOf(account),
        ]);
        me = { bids, excess, tokensFor, refundFor, pendingRefund, eth, auc };
      }

      const events = logs
        .map((log) => {
          try {
            const parsed = auctionIface.parseLog(log);
            return parsed && { name: parsed.name, args: parsed.args, block: log.blockNumber, tx: log.transactionHash, index: log.index };
          } catch {
            return null;
          }
        })
        .filter(Boolean)
        .reverse();

      anchor.current = nextAnchor(anchor.current, block, pendingTs, Date.now());
      setSnapshot({
        view: {
          startTime,
          endTime,
          startPrice,
          reservePrice,
          tokenSupply,
          totalCommitted,
          soldOut,
          finalized,
          clearingPrice,
          tokensSold,
          proceeds,
          seller,
        },
        tokenTotalSupply,
        contractEth,
        me,
        events,
        blockNumber: block.number,
      });
      setError(null);
    } catch (e) {
      setError(isNodeUnreachable(e) ? "no-node" : e?.shortMessage || e?.message);
    }
  }, [account]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  // Re-render every second so the countdown and price move between polls.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!snapshot) return { loading: !error, error, refresh };

  // Time of the next block (what a transaction sent now will see), not the latest block's time.
  const now = chainNow(anchor.current, Date.now());
  const a = snapshot.view;
  const price = priceAt(a, now); // live price: what a bid sent now pays
  const status = deriveStatus(a, now);
  // ISSUE-008: once bidding is over, demand figures are shown at the (expected) clearing price,
  // and the clock stops at a sell-out instead of counting down to the unused endTime.
  const shownPrice = displayPrice(a, now, status);
  const remainingEth = remainingEthAt(a, shownPrice);

  return {
    loading: false,
    error,
    refresh,
    ...snapshot,
    now,
    price,
    shownPrice,
    status,
    secondsLeft: a.soldOut || a.finalized ? 0n : timeLeft(a, now),
    maxCommit: maxCommitAt(a, shownPrice),
    remainingEth,
    tokensRemaining: tokensForEth(remainingEth, shownPrice),
    progressBps: progressBps(a, shownPrice),
  };
}
