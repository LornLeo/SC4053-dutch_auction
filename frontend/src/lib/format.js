import { formatUnits } from "ethers";

/** Format a BigInt amount with `decimals` decimals, truncated (not rounded) to `dp` places, with separators. */
export function formatAmount(value, decimals = 18, dp = 4) {
  if (value === undefined || value === null) return "–";
  let [int, frac = ""] = formatUnits(value, decimals).split(".");
  const negative = int.startsWith("-");
  if (negative) int = int.slice(1);
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  frac = frac.slice(0, dp).padEnd(dp, "0");
  return (negative ? "-" : "") + (dp > 0 ? `${int}.${frac}` : int);
}

export const formatEth = (wei, dp = 4) => formatAmount(wei, 18, dp);
export const formatTokens = (units, dp = 2) => formatAmount(units, 18, dp);
/** Full precision, for tooltips. */
export const fullEth = (wei) => (wei === undefined || wei === null ? "" : `${formatUnits(wei, 18)} ETH`);

export const shortAddr = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function formatCountdown(seconds) {
  const s = Number(seconds);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
