import { useTx } from "../context/TxContext.jsx";
import { shortAddr } from "../lib/format.js";

const ICON = { wallet: "◌", pending: "◔", confirmed: "✓", failed: "✕", cancelled: "–" };

export function Toasts() {
  const { toasts, dismiss } = useTx();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.status}`}>
          <span className="toast-icon" aria-hidden="true">
            {ICON[t.status]}
          </span>
          <div className="toast-body">
            <strong>{t.label}</strong>
            <span>{t.message}</span>
            {t.hash && (
              <span className="mono small muted" title={t.hash}>
                tx {shortAddr(t.hash)}
              </span>
            )}
          </div>
          <button className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
