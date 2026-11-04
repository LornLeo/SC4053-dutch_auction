import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { auctionIface } from "../lib/contract.js";
import { decodeError } from "../lib/errors.js";

// One helper for every write (FRONTEND_SPEC.md §9):
// confirm in wallet -> pending (hash) -> confirmed (block) | failed | cancelled.
const TxContext = createContext(null);

export function TxProvider({ children, onConfirmed }) {
  const [toasts, setToasts] = useState([]);
  const [busyKeys, setBusyKeys] = useState(() => new Set());
  const nextId = useRef(1);

  const update = useCallback((id, patch) => {
    setToasts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  const dismiss = useCallback((id) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const setBusy = useCallback((key, on) => {
    setBusyKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  /**
   * run("bid", "Place bid", () => auction.bid({ value })) — returns true when the tx is confirmed.
   * `key` disables the matching button while the tx is in flight.
   */
  const run = useCallback(
    async (key, label, send) => {
      const id = nextId.current++;
      setBusy(key, true);
      setToasts((ts) => [...ts, { id, label, status: "wallet", message: "Confirm in your wallet…" }]);
      try {
        const tx = await send();
        update(id, { status: "pending", hash: tx.hash, message: "Pending…" });
        const receipt = await tx.wait();
        update(id, { status: "confirmed", message: `Confirmed in block ${receipt.blockNumber}` });
        setTimeout(() => dismiss(id), 6000);
        onConfirmed?.();
        return true;
      } catch (err) {
        const decoded = decodeError(err, auctionIface);
        update(id, { status: decoded.cancelled ? "cancelled" : "failed", message: decoded.message });
        setTimeout(() => dismiss(id), decoded.cancelled ? 4000 : 10000);
        return false;
      } finally {
        setBusy(key, false);
      }
    },
    [dismiss, onConfirmed, setBusy, update]
  );

  const value = useMemo(
    () => ({ run, busy: (key) => busyKeys.has(key), anyBusy: busyKeys.size > 0, toasts, dismiss }),
    [run, busyKeys, toasts, dismiss]
  );
  return <TxContext.Provider value={value}>{children}</TxContext.Provider>;
}

export function useTx() {
  const ctx = useContext(TxContext);
  if (!ctx) throw new Error("useTx must be used inside <TxProvider>");
  return ctx;
}
