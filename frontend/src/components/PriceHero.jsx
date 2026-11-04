import { DURATION, Status } from "../lib/auctionMath.js";
import { formatCountdown, formatEth, fullEth } from "../lib/format.js";

const STATUS_CLASS = {
  [Status.NOT_STARTED]: "badge-idle",
  [Status.ACTIVE]: "badge-live",
  [Status.DEMAND_MET]: "badge-warn",
  [Status.SOLD_OUT]: "badge-done",
  [Status.ENDED]: "badge-done",
  [Status.FINALIZED]: "badge-final",
};

const STATUS_HINT = {
  [Status.NOT_STARTED]: "Waiting for the seller to start the 20-minute clock.",
  [Status.ACTIVE]: "Bidding is open. The price falls every second until the auction sells out.",
  [Status.DEMAND_MET]:
    "Committed ETH already buys the whole supply at this price. Bidding is closed; finalize opens when the timer ends.",
  [Status.SOLD_OUT]: "A bid filled the supply. Anyone can finalize now.",
  [Status.ENDED]: "Time is up. Anyone can finalize now.",
  [Status.FINALIZED]: "Clearing price fixed. Bidders can claim tokens and refunds.",
};

export function StatusBadge({ status }) {
  return <span className={`badge ${STATUS_CLASS[status]}`}>{status}</span>;
}

// ISSUE-008: what the headline price and clock mean depends on the status.
const PRICE_LABEL = {
  [Status.NOT_STARTED]: "Starting price",
  [Status.ACTIVE]: "Current price",
  [Status.DEMAND_MET]: "Expected clearing price",
  [Status.ENDED]: "Expected clearing price",
  [Status.SOLD_OUT]: "Clearing price",
  [Status.FINALIZED]: "Clearing price",
};
const CLOCK_LABEL = {
  [Status.NOT_STARTED]: "Duration",
  [Status.ACTIVE]: "Time left",
  [Status.DEMAND_MET]: "Finalize opens in",
};

export function PriceHero({ a }) {
  const { view, shownPrice, status, secondsLeft } = a;
  const clockLabel = CLOCK_LABEL[status];
  return (
    <section className="card hero">
      <div className="hero-top">
        <StatusBadge status={status} />
        <p className="muted small">{STATUS_HINT[status]}</p>
      </div>
      <div className="hero-stats">
        <div>
          <p className="label">{PRICE_LABEL[status]}</p>
          <p className="big" title={fullEth(shownPrice)}>
            {formatEth(shownPrice)}
            <span className="unit"> ETH / AUC</span>
          </p>
        </div>
        <div>
          <p className="label">{clockLabel ?? "Bidding"}</p>
          <p className="big mono">{clockLabel ? formatCountdown(secondsLeft) : "Closed"}</p>
        </div>
        <div className="hero-range">
          <p className="label">Start → reserve</p>
          <p>
            {formatEth(view.startPrice, 2)} → {formatEth(view.reservePrice, 2)} ETH
          </p>
        </div>
      </div>
      <PriceChart a={a} />
    </section>
  );
}

/** Linear decay from startPrice to reservePrice over 20 minutes, with a marker at chain time. */
function PriceChart({ a }) {
  const { view, now, price } = a;
  const W = 640;
  const H = 170;
  const pad = { l: 46, r: 14, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const hi = Number(view.startPrice);
  const lo = Number(view.reservePrice);
  const y = (p) => pad.t + ((hi - Number(p)) / (hi - lo)) * ih;
  const x = (s) => pad.l + (s / Number(DURATION)) * iw;

  // The moving "now" marker only makes sense while bids can still land (ISSUE-008).
  const started = view.startTime !== 0n && (a.status === Status.ACTIVE || a.status === Status.DEMAND_MET);
  const elapsed = started ? Math.min(Number(DURATION), Math.max(0, Number(now - view.startTime))) : 0;
  const clearing = a.status === Status.ENDED || a.status === Status.DEMAND_MET ? a.shownPrice : view.clearingPrice;

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Price decay over 20 minutes">
      <defs>
        <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((f) => (
        <line key={f} x1={pad.l} x2={W - pad.r} y1={pad.t + f * ih} y2={pad.t + f * ih} className="grid" />
      ))}
      <text x={pad.l - 8} y={pad.t + 4} className="axis" textAnchor="end">
        {formatEth(view.startPrice, 2)}
      </text>
      <text x={pad.l - 8} y={pad.t + ih + 4} className="axis" textAnchor="end">
        {formatEth(view.reservePrice, 2)}
      </text>
      <text x={pad.l} y={H - 6} className="axis">0 min</text>
      <text x={pad.l + iw / 2} y={H - 6} className="axis" textAnchor="middle">10 min</text>
      <text x={W - pad.r} y={H - 6} className="axis" textAnchor="end">20 min</text>

      <path
        d={`M${x(0)},${y(view.startPrice)} L${x(1200)},${y(view.reservePrice)} L${x(1200)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`}
        fill="url(#fill)"
      />
      <line x1={x(0)} y1={y(view.startPrice)} x2={x(1200)} y2={y(view.reservePrice)} className="line-future" />
      {started && (
        <line x1={x(0)} y1={y(view.startPrice)} x2={x(elapsed)} y2={y(price)} className="line-past" />
      )}
      {clearing > 0n && (
        <>
          <line x1={pad.l} x2={W - pad.r} y1={y(clearing)} y2={y(clearing)} className="line-clearing" />
          <text x={W - pad.r} y={y(clearing) - 5} className="axis axis-strong" textAnchor="end">
            {view.finalized || view.soldOut ? "clearing" : "expected clearing"} {formatEth(clearing, 4)}
          </text>
        </>
      )}
      {started && <circle cx={x(elapsed)} cy={y(price)} r="5" className="now-dot" />}
    </svg>
  );
}
