import { useWallet } from "../context/WalletContext.jsx";
import { CONFIG } from "../lib/contract.js";
import { formatEth, formatTokens, shortAddr } from "../lib/format.js";

export function Header({ me }) {
  const w = useWallet();
  return (
    <header className="header">
      <div className="brand">
        <span className="logo" aria-hidden="true" />
        <div>
          <h1>AUC Dutch Auction</h1>
          <p className="muted small">20-minute descending-price token launch</p>
        </div>
      </div>

      <div className="wallet">
        {w.account ? (
          <>
            <div className="wallet-info">
              <span className="pill" title={w.account}>
                <span className={`dot ${w.wrongNetwork ? "dot-bad" : "dot-ok"}`} />
                {shortAddr(w.account)}
              </span>
              <span className="muted small">
                {w.mode === "local" ? "Local test account" : "MetaMask"} · chain {w.chainId}
              </span>
              {me && (
                <span className="small">
                  {formatEth(me.eth, 2)} ETH · {formatTokens(me.auc)} AUC
                </span>
              )}
            </div>
            <button className="btn btn-ghost" onClick={w.disconnect}>
              Disconnect
            </button>
          </>
        ) : (
          <>
            {w.hasMetaMask && (
              <button className="btn btn-primary" onClick={w.connectMetaMask}>
                Connect MetaMask
              </button>
            )}
            {w.localAccounts.length > 0 && (
              <select
                className="select"
                aria-label="Use a local test account"
                value=""
                onChange={(e) => w.selectLocalAccount(e.target.value)}
              >
                <option value="">Use local test account…</option>
                {w.localAccounts.map((a, i) => (
                  <option key={a} value={a}>
                    #{i} {shortAddr(a)}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {w.error && <p className="banner banner-bad">{w.error}</p>}
      {w.wrongNetwork && (
        <div className="banner banner-warn">
          MetaMask is on chain {w.chainId}. This app runs on Hardhat Local (chain {CONFIG.chainId}).
          <button className="btn btn-small" onClick={() => w.switchNetwork().catch(() => {})}>
            Switch to Hardhat Local
          </button>
        </div>
      )}
    </header>
  );
}
