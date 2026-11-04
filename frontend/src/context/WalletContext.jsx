import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider, getAddress } from "ethers";
import { CONFIG, POLLING_MS, readProvider } from "../lib/contract.js";

// Wallet layer (FRONTEND_SPEC.md §3): MetaMask, or one of the local node's unlocked test accounts.
const WalletContext = createContext(null);

const EMPTY = { mode: "none", account: null, chainId: null, signer: null };
const CHAIN_HEX = "0x" + CONFIG.chainId.toString(16);

export function WalletProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  const [localAccounts, setLocalAccounts] = useState([]);
  const [error, setError] = useState(null);
  const hasMetaMask = typeof window !== "undefined" && !!window.ethereum;

  // The node's unlocked accounts, offered only on the local Hardhat chain.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const chainId = Number(await readProvider.send("eth_chainId", []));
        if (chainId !== 31337) return;
        const accounts = await readProvider.send("eth_accounts", []);
        if (!cancelled) setLocalAccounts(accounts.map((a) => getAddress(a)));
      } catch {
        if (!cancelled) setLocalAccounts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncMetaMask = useCallback(async () => {
    // A fresh BrowserProvider each time: ethers caches the network, which goes stale after chainChanged.
    const provider = new BrowserProvider(window.ethereum);
    provider.pollingInterval = POLLING_MS; // ISSUE-007: default 4 s receipt polling
    const accounts = await provider.send("eth_accounts", []);
    if (!accounts.length) {
      setState(EMPTY);
      return;
    }
    const net = await provider.getNetwork();
    const signer = await provider.getSigner(accounts[0]);
    setState({ mode: "metamask", account: getAddress(accounts[0]), chainId: Number(net.chainId), signer });
  }, []);

  const connectMetaMask = useCallback(async () => {
    setError(null);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      await syncMetaMask();
    } catch (e) {
      setError(e?.code === 4001 ? "Connection request was rejected." : e?.message || "Could not connect.");
    }
  }, [syncMetaMask]);

  useEffect(() => {
    if (state.mode !== "metamask" || !window.ethereum) return undefined;
    const onChange = () => {
      syncMetaMask().catch(() => setState(EMPTY));
    };
    window.ethereum.on("accountsChanged", onChange);
    window.ethereum.on("chainChanged", onChange);
    return () => {
      window.ethereum.removeListener("accountsChanged", onChange);
      window.ethereum.removeListener("chainChanged", onChange);
    };
  }, [state.mode, syncMetaMask]);

  const selectLocalAccount = useCallback(async (address) => {
    setError(null);
    if (!address) {
      setState(EMPTY);
      return;
    }
    const signer = await readProvider.getSigner(address);
    setState({ mode: "local", account: getAddress(address), chainId: CONFIG.chainId, signer });
  }, []);

  const disconnect = useCallback(() => setState(EMPTY), []);

  const switchNetwork = useCallback(async () => {
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_HEX }] });
    } catch (e) {
      if (e?.code !== 4902) throw e;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_HEX,
            chainName: "Hardhat Local",
            rpcUrls: ["http://127.0.0.1:8545"],
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          },
        ],
      });
    }
  }, []);

  const wrongNetwork = state.mode === "metamask" && state.chainId !== CONFIG.chainId;

  const value = useMemo(
    () => ({
      ...state,
      hasMetaMask,
      localAccounts,
      error,
      wrongNetwork,
      canWrite: !!state.signer && !wrongNetwork,
      connectMetaMask,
      selectLocalAccount,
      disconnect,
      switchNetwork,
    }),
    [state, hasMetaMask, localAccounts, error, wrongNetwork, connectMetaMask, selectLocalAccount, disconnect, switchNetwork]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}
