import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG, auctionIface, readAuction, readProvider, readToken } from "../lib/contract.js";
import {
  deriveStatus,
  maxCommitAt,
  priceAt,
  progressBps,
  remainingEthAt,
  timeLeft,
  tokensForEth,
} from "../lib/auctionMath.js";
import { chainNow, nextAnchor } from "../lib/chainClock.js";

const POLL_MS = 2000;

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
  const anchor = useRef(null); // { blockNumber, chainTs: BigInt, localMs } — see lib/chainClock.js

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

      anchor.current = nextAnchor(anchor.current, block, Date.now());
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
      setError(e?.code === "NETWORK_ERROR" || e?.code === "ECONNREFUSED" ? "no-node" : e?.shortMessage || e?.message);
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
  const price = priceAt(a, now);
  const status = deriveStatus(a, now);
  const remainingEth = remainingEthAt(a, price);

  return {
    loading: false,
    error,
    refresh,
    ...snapshot,
    now,
    price,
    status,
    secondsLeft: timeLeft(a, now),
    maxCommit: maxCommitAt(a, price),
    remainingEth,
    tokensRemaining: tokensForEth(remainingEth, price),
    progressBps: progressBps(a, price),
  };
}
