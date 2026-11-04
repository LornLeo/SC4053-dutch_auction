import { formatEth, formatTokens, shortAddr } from "../lib/format.js";

function describe(e) {
  const a = e.args;
  switch (e.name) {
    case "AuctionStarted":
      return "Auction started";
    case "BidPlaced":
      return `${shortAddr(a.bidder)} bid ${formatEth(a.amountAccepted)} ETH at ${formatEth(a.priceAtBid)}${
        a.amountRefundable > 0n ? ` (${formatEth(a.amountRefundable)} ETH refundable)` : ""
      }`;
    case "AuctionCleared":
      return `Sold out at ${formatEth(a.clearingPrice)} ETH per AUC`;
    case "AuctionFinalized":
      return `Finalized: ${formatTokens(a.tokensSold)} sold, ${formatTokens(a.tokensBurned)} burned`;
    case "Claimed":
      return `${shortAddr(a.bidder)} claimed ${formatTokens(a.tokensReceived)} AUC + ${formatEth(a.ethRefunded)} ETH`;
    case "RefundDeferred":
      return `Refund of ${formatEth(a.amount)} ETH held for ${shortAddr(a.bidder)}`;
    case "RefundWithdrawn":
      return `${shortAddr(a.bidder)} withdrew ${formatEth(a.amount)} ETH to ${shortAddr(a.to)}`;
    case "ProceedsWithdrawn":
      return `Seller withdrew ${formatEth(a.amount)} ETH`;
    default:
      return e.name;
  }
}

export function ActivityFeed({ events }) {
  return (
    <section className="card">
      <h2>Activity</h2>
      {events.length === 0 ? (
        <p className="muted">No activity yet.</p>
      ) : (
        <ol className="feed">
          {events.slice(0, 50).map((e) => (
            <li key={`${e.tx}-${e.index}`} className={`feed-item feed-${e.name}`}>
              <span>{describe(e)}</span>
              <span className="muted small mono" title={e.tx}>
                block {e.block}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
