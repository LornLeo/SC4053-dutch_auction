import { useState } from "react";
import { parseEther } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useTx } from "../context/TxContext.jsx";
import { writeContracts } from "../lib/contract.js";
import { Status, bidEstimate, biddingOpen } from "../lib/auctionMath.js";
import { formatEth, formatTokens, fullEth } from "../lib/format.js";

export function ProgressCard({ a }) {
  return (
    <section className="card">
      <h2>Demand</h2>
      <div className="progress" aria-label="Committed against what sells out the supply">
        <div className="progress-bar" style={{ width: `${a.progressBps / 100}%` }} />
      </div>
      <dl className="stats">
        <div>
          <dt>Committed</dt>
          <dd title={fullEth(a.view.totalCommitted)}>{formatEth(a.view.totalCommitted, 2)} ETH</dd>
        </div>
        <div>
          <dt>Sells out at</dt>
          <dd title={fullEth(a.maxCommit)}>{formatEth(a.maxCommit, 2)} ETH</dd>
        </div>
        <div>
          <dt>ETH still accepted</dt>
          <dd>{formatEth(a.remainingEth, 2)} ETH</dd>
        </div>
        <div>
          <dt>{biddingOpen(a.status) ? "Tokens left at this price" : "Tokens unsold (burned at finalize)"}</dt>
          <dd>{formatTokens(a.tokensRemaining)} AUC</dd>
        </div>
      </dl>
    </section>
  );
}

export function BidForm({ a }) {
  const w = useWallet();
  const tx = useTx();
  const [amount, setAmount] = useState("");

  let wei = null;
  let inputError = null;
  if (amount.trim()) {
    try {
      wei = parseEther(amount.trim());
      if (wei <= 0n) inputError = "Enter an amount above zero.";
    } catch {
      inputError = "Enter a valid ETH amount, e.g. 1.5";
    }
  }
  const est = wei && wei > 0n ? bidEstimate(a.view, wei, a.price) : null;
  const open = a.status === Status.ACTIVE;
  const tooMuch = wei && a.me && wei > a.me.eth;
  const disabled = !open || !w.canWrite || !wei || !!inputError || tooMuch || tx.busy("bid");

  const submit = async (e) => {
    e.preventDefault();
    if (disabled) return;
    const ok = await tx.run("bid", `Bid ${amount} ETH`, () => writeContracts(w.signer).auction.bid({ value: wei }));
    if (ok) setAmount("");
  };

  return (
    <section className="card">
      <h2>Place a bid</h2>
      <form onSubmit={submit} className="form">
        <label className="label" htmlFor="bid-amount">
          Amount (ETH)
        </label>
        <div className="input-row">
          <input
            id="bid-amount"
            className="input"
            inputMode="decimal"
            placeholder="0.0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!open}
          />
          <button type="submit" className="btn btn-primary" disabled={disabled}>
            {tx.busy("bid") ? "Bidding…" : "Bid"}
          </button>
        </div>
        <div className="chips">
          {["1", "10", "100"].map((v) => (
            <button type="button" key={v} className="chip" disabled={!open} onClick={() => setAmount(v)}>
              {v} ETH
            </button>
          ))}
          <button
            type="button"
            className="chip"
            disabled={!open || a.remainingEth === 0n}
            onClick={() => setAmount(formatEth(a.remainingEth, 18).replace(/,/g, ""))}
          >
            Fill the rest
          </button>
        </div>

        {inputError && <p className="note note-bad">{inputError}</p>}
        {tooMuch && <p className="note note-bad">That is more ETH than this account holds.</p>}
        {est && (
          <div className="estimate">
            <p>
              ≈ <strong>{formatTokens(est.tokens)} AUC</strong> at today's price of {formatEth(a.price)} ETH
            </p>
            {est.partial && est.refundable > 0n && (
              <p className="note note-warn">
                This bid sells out the auction. Only {formatEth(est.accepted)} ETH is accepted; the other{" "}
                <span title={fullEth(est.refundable)}>{formatEth(est.refundable)} ETH</span> is refunded when you claim.
              </p>
            )}
            {est.partial && est.refundable === 0n && (
              <p className="note note-warn">This bid exactly fills the supply and sells out the auction.</p>
            )}
          </div>
        )}
        <p className="note">
          Every winner pays the same <strong>final clearing price</strong>, which is at or below today's price, so you
          may receive more tokens than shown, never fewer for the ETH accepted.
        </p>
        {!w.account && <p className="note">Connect a wallet to bid.</p>}
        {!open && <p className="note">Bidding is closed ({a.status}).</p>}
      </form>
    </section>
  );
}
