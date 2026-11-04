import { WalletProvider, useWallet } from "./context/WalletContext.jsx";
import { TxProvider } from "./context/TxContext.jsx";
import { useAuction } from "./hooks/useAuction.js";
import { CONFIG } from "./lib/contract.js";
import { Header } from "./components/Header.jsx";
import { PriceHero } from "./components/PriceHero.jsx";
import { BidForm, ProgressCard } from "./components/BidPanel.jsx";
import { MyPosition, ResultsCard, SettlementCard } from "./components/Settlement.jsx";
import { SellerPanel } from "./components/SellerPanel.jsx";
import { ActivityFeed } from "./components/ActivityFeed.jsx";
import { Toasts } from "./components/Toasts.jsx";
import { shortAddr } from "./lib/format.js";

function Dashboard() {
  const w = useWallet();
  const a = useAuction(w.account);

  return (
    <TxProvider onConfirmed={a.refresh}>
      <div className="app">
        <Header me={a.me} />
        <main>
          {a.error === "no-node" && (
            <div className="banner banner-bad">
              Cannot reach the local Hardhat node. Start it with <code>npx hardhat node</code>.
            </div>
          )}
          {a.error === "not-deployed" && (
            <div className="banner banner-bad">
              No contract at {shortAddr(CONFIG.auction.address)} on this chain. Run{" "}
              <code>npx hardhat run scripts/deploy.js --network localhost</code>.
            </div>
          )}
          {a.error && !["no-node", "not-deployed"].includes(a.error) && (
            <div className="banner banner-bad">{a.error}</div>
          )}
          {a.loading && <Skeleton />}
          {a.view && (
            <>
              <PriceHero a={a} />
              <SellerPanel a={a} />
              <div className="grid">
                <div className="col">
                  <BidForm a={a} />
                  <MyPosition a={a} />
                </div>
                <div className="col">
                  <ProgressCard a={a} />
                  <SettlementCard a={a} />
                </div>
              </div>
              <ResultsCard a={a} />
              <ActivityFeed events={a.events} />
            </>
          )}
        </main>
        <footer className="footer muted small">
          Auction {shortAddr(CONFIG.auction.address)} · Token {shortAddr(CONFIG.token.address)} · chain {CONFIG.chainId}
        </footer>
      </div>
      <Toasts />
    </TxProvider>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading auction">
      <div className="card skeleton" style={{ height: 300 }} />
      <div className="grid">
        <div className="card skeleton" style={{ height: 220 }} />
        <div className="card skeleton" style={{ height: 220 }} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <WalletProvider>
      <Dashboard />
    </WalletProvider>
  );
}
