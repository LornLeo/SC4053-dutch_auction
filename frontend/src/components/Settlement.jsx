import { useEffect, useState } from "react";
import { getAddress, isAddress } from "ethers";
import { useWallet } from "../context/WalletContext.jsx";
import { useTx } from "../context/TxContext.jsx";
import { readAuction, writeContracts } from "../lib/contract.js";
import { Status, canFinalize } from "../lib/auctionMath.js";
import { formatEth, formatTokens, fullEth, shortAddr } from "../lib/format.js";

export function MyPosition({ a }) {
  const w = useWallet();
  const tx = useTx();
  const [to, setTo] = useState("");
  const me = a.me;

  if (!w.account || !me) {
    return (
      <section className="card">
        <h2>My position</h2>
        <p className="muted">Connect a wallet to see your bids, tokens and refunds.</p>
      </section>
    );
  }

  const finalized = a.view.finalized;
  const hasClaim = me.bids > 0n || me.excess > 0n;
  const auction = () => writeContracts(w.signer).auction;
  const target = to.trim() || w.account;
  const targetOk = isAddress(target);

  return (
    <section className="card">
      <h2>My position</h2>
      <dl className="stats">
        <div>
          <dt>ETH committed</dt>
          <dd title={fullEth(me.bids)}>{formatEth(me.bids)} ETH</dd>
        </div>
        <div>
          <dt>Surplus from a sell-out bid</dt>
          <dd title={fullEth(me.excess)}>{formatEth(me.excess)} ETH</dd>
        </div>
        {finalized && (
          <>
            <div>
              <dt>Tokens to claim</dt>
              <dd>{formatTokens(me.tokensFor)} AUC</dd>
            </div>
            <div>
              <dt>Refund on claim</dt>
              <dd title={fullEth(me.refundFor)}>{formatEth(me.refundFor)} ETH</dd>
            </div>
          </>
        )}
      </dl>

      {finalized && hasClaim && (
        <button
          className="btn btn-primary btn-block"
          disabled={!w.canWrite || tx.busy("claim")}
          onClick={() => tx.run("claim", "Claim tokens and refund", () => auction().claim())}
        >
          {tx.busy("claim") ? "Claiming…" : `Claim ${formatTokens(me.tokensFor)} AUC + ${formatEth(me.refundFor)} ETH`}
        </button>
      )}
      {finalized && !hasClaim && me.auc > 0n && <p className="note note-ok">Claimed. You hold {formatTokens(me.auc)} AUC.</p>}
      {!finalized && hasClaim && (
        <p className="note">Tokens and any refund become claimable after the auction is finalized.</p>
      )}

      {me.pendingRefund > 0n && (
        <div className="subcard">
          <p>
            <strong>{formatEth(me.pendingRefund)} ETH</strong> refund could not be delivered to this address. Withdraw it
            to any address:
          </p>
          <div className="input-row">
            <input
              className="input"
              placeholder={w.account}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Refund destination address"
            />
            <button
              className="btn"
              disabled={!w.canWrite || !targetOk || tx.busy("withdrawRefund")}
              onClick={() =>
                tx.run("withdrawRefund", "Withdraw refund", () => auction().withdrawRefund(getAddress(target)))
              }
            >
              Withdraw
            </button>
          </div>
          {!targetOk && <p className="note note-bad">Not a valid address.</p>}
        </div>
      )}
    </section>
  );
}

export function SettlementCard({ a }) {
  const w = useWallet();
  const tx = useTx();
  const [bidder, setBidder] = useState("");
  const [check, setCheck] = useState(null);

  const auction = () => writeContracts(w.signer).auction;
  const finalizable = canFinalize(a.status);
  const valid = isAddress(bidder.trim());

  // ISSUE-009: re-check what the bidder is owed on every new block (so a settled bidder disables
  // the button), ignore out-of-order answers while typing, and never leave a rejected promise.
  useEffect(() => {
    setCheck(null);
    if (!isAddress(bidder.trim())) return undefined;
    const addr = getAddress(bidder.trim());
    let stale = false;
    Promise.all([readAuction.bids(addr), readAuction.excess(addr)])
      .then(([bids, excess]) => !stale && setCheck({ addr, owed: bids > 0n || excess > 0n }))
      .catch(() => !stale && setCheck(null));
    return () => {
      stale = true;
    };
  }, [bidder, a.blockNumber]);

  const lookup = (value) => setBidder(value);

  return (
    <section className="card">
      <h2>Settlement</h2>
      <p className="muted small">
        Anyone can finalize once the auction sells out or time runs out. Finalizing fixes the clearing price and burns
        unsold tokens.
      </p>
      <button
        className="btn btn-primary btn-block"
        disabled={!finalizable || !w.canWrite || tx.busy("finalize")}
        onClick={() => tx.run("finalize", "Finalize auction", () => auction().finalize())}
      >
        {a.view.finalized ? "Finalized" : tx.busy("finalize") ? "Finalizing…" : "Finalize auction"}
      </button>
      {a.status === Status.DEMAND_MET && (
        <p className="note note-warn">Demand already covers supply, but finalize only opens when the timer ends.</p>
      )}

      {a.view.finalized && (
        <div className="subcard">
          <p className="label">Settle another bidder</p>
          <p className="muted small">
            Sends that bidder's tokens and refund <strong>to the bidder</strong>, never to you.
          </p>
          <div className="input-row">
            <input
              className="input"
              placeholder="0x… bidder address"
              value={bidder}
              onChange={(e) => lookup(e.target.value)}
              aria-label="Bidder address"
            />
            <button
              className="btn"
              disabled={!w.canWrite || !valid || !check?.owed || tx.busy("claimFor")}
              onClick={() =>
                tx.run("claimFor", `Settle ${shortAddr(bidder)}`, () => auction().claimFor(getAddress(bidder.trim())))
              }
            >
              Settle
            </button>
          </div>
          {bidder && !valid && <p className="note note-bad">Not a valid address.</p>}
          {check && !check.owed && <p className="note">Nothing left to settle for {shortAddr(check.addr)}.</p>}
        </div>
      )}
    </section>
  );
}

export function ResultsCard({ a }) {
  if (!a.view.finalized) return null;
  const burned = a.view.tokenSupply - a.view.tokensSold;
  return (
    <section className="card">
      <h2>Results</h2>
      <dl className="stats stats-4">
        <div>
          <dt>Clearing price</dt>
          <dd title={fullEth(a.view.clearingPrice)}>{formatEth(a.view.clearingPrice)} ETH</dd>
        </div>
        <div>
          <dt>Tokens sold</dt>
          <dd>{formatTokens(a.view.tokensSold)} AUC</dd>
        </div>
        <div>
          <dt>Tokens burned</dt>
          <dd>{formatTokens(burned)} AUC</dd>
        </div>
        <div>
          <dt>AUC total supply now</dt>
          <dd>{formatTokens(a.tokenTotalSupply)} AUC</dd>
        </div>
        <div>
          <dt>Proceeds awaiting seller</dt>
          <dd>{formatEth(a.view.proceeds)} ETH</dd>
        </div>
        <div>
          <dt>ETH held by contract</dt>
          <dd title={fullEth(a.contractEth)}>{formatEth(a.contractEth)} ETH</dd>
        </div>
      </dl>
    </section>
  );
}
