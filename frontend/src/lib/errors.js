// Turns wallet / RPC errors into short, plain-English messages (FRONTEND_SPEC.md §9).
// Custom error names are those declared in contracts/IDutchAuction.sol.

export const ERROR_MESSAGES = {
  InvalidParams: "Invalid parameters (for example the zero address).",
  NotSeller: "Only the seller can do this.",
  AlreadyStarted: "The auction has already started.",
  AuctionNotStarted: "The auction has not started yet.",
  AuctionNotActive:
    "Bidding is closed: the auction has ended, sold out, or demand already covers the supply at the current price.",
  AuctionNotEnded: "The auction can only be finalized after it sells out or the 20 minutes are over.",
  AuctionAlreadyFinalized: "The auction is already finalized.",
  AuctionNotFinalized: "The auction must be finalized first.",
  NothingToClaim: "Nothing to claim for this address.",
  ZeroBid: "Enter an amount above zero.",
  TransferFailed: "An ETH transfer failed.",
  ReentrancyGuardReentrantCall: "Re-entrant call blocked.",
};

/** Walk a nested error object looking for revert data (0x + 4-byte selector...). */
function findRevertData(err) {
  const seen = new Set();
  const stack = [err];
  while (stack.length) {
    const e = stack.pop();
    if (!e || typeof e !== "object" || seen.has(e)) continue;
    seen.add(e);
    if (typeof e.data === "string" && e.data.startsWith("0x") && e.data.length >= 10) return e.data;
    for (const key of ["error", "info", "data", "cause", "payload"]) {
      if (e[key] && typeof e[key] === "object") stack.push(e[key]);
    }
  }
  return null;
}

/** Returns { cancelled?, name?, message } for any error thrown by ethers or the wallet. */
export function decodeError(err, iface) {
  const code = err?.code ?? err?.info?.error?.code;
  if (code === "ACTION_REJECTED" || code === 4001) {
    return { cancelled: true, message: "Cancelled in wallet." };
  }
  let name = err?.revert?.name;
  if (!name && iface) {
    const data = findRevertData(err);
    if (data) {
      try {
        name = iface.parseError(data)?.name;
      } catch {
        /* not one of our errors */
      }
    }
  }
  if (name) return { name, message: ERROR_MESSAGES[name] ?? name };
  return { message: err?.shortMessage || err?.reason || err?.message || "Transaction failed." };
}
