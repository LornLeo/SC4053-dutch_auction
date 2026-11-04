import { useState } from "react";
import { useWallet } from "../context/WalletContext.jsx";
import { useTx } from "../context/TxContext.jsx";
import { readAuction, writeContracts } from "../lib/contract.js";
import { formatEth, shortAddr } from "../lib/format.js";

// Shown only to the seller. Hiding it is a UX nicety, not security: the contract itself reverts with
// NotSeller for start() and withdrawProceeds() from any other account.
export function SellerPanel({ a }) {
  const w = useWallet();
  const tx = useTx();
  const [progress, setProgress] = useState(null);
  const [settling, setSettling] = useState(false); // ISSUE-009: busy for the whole loop, not per tx

  const isSeller = w.account && a.view.seller.toLowerCase() === w.account.toLowerCase();
  if (!isSeller) return null;

  const auction = () => writeContracts(w.signer).auction;
  const notStarted = a.view.startTime === 0n;

  const bidders = [...new Set(a.events.filter((e) => e.name === "BidPlaced").map((e) => e.args.bidder))];

  const settleAll = async () => {
    if (settling) return;
    setSettling(true);
    try {
      const owed = [];
      for (const b of bidders) {
        const [bids, excess] = await Promise.all([readAuction.bids(b), readAuction.excess(b)]);
        if (bids > 0n || excess > 0n) owed.push(b);
      }
      setProgress({ done: 0, total: owed.length });
      let done = 0;
      for (const b of owed) {
        if (await tx.run("settleAll", `Settle ${shortAddr(b)}`, () => auction().claimFor(b))) done++;
        setProgress({ done, total: owed.length });
      }
    } finally {
      setSettling(false);
    }
  };

  return (
    <section className="card card-seller">
      <h2>Seller controls</h2>
      <div className="seller-actions">
        <button
          className="btn btn-primary"
          disabled={!notStarted || !w.canWrite || tx.busy("start")}
          onClick={() => tx.run("start", "Start auction", () => auction().start())}
        >
          {notStarted ? "Start auction" : "Started"}
        </button>
        <button
          className="btn"
          disabled={!a.view.finalized || a.view.proceeds === 0n || !w.canWrite || tx.busy("withdrawProceeds")}
          onClick={() => tx.run("withdrawProceeds", "Withdraw proceeds", () => auction().withdrawProceeds())}
        >
          Withdraw {formatEth(a.view.proceeds)} ETH proceeds
        </button>
        <button
          className="btn"
          disabled={!a.view.finalized || !w.canWrite || settling || bidders.length === 0}
          onClick={settleAll}
        >
          {settling ? "Settling…" : "Settle all bidders"}
        </button>
      </div>
      {progress && (
        <p className="note">
          Settled {progress.done} of {progress.total} bidders with something owed.
        </p>
      )}
      <p className="muted small">
        Proceeds accrue as bidders claim. "Settle all" calls claimFor for every bidder who has not claimed, so no
        unclaimed bid can lock your ETH.
      </p>
    </section>
  );
}
