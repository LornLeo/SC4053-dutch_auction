import { Contract, Interface, JsonRpcProvider, Network } from "ethers";
import config from "../contracts.json";

// contracts.json is written by scripts/deploy.js and scripts/seed.js (scripts/exportFrontend.js).
export const CONFIG = config;

// Reads go straight to the local node (proxied by Vite at /rpc), so the page works without a wallet.
export const RPC_URL = import.meta.env.VITE_RPC_URL || `${window.location.origin}/rpc`;

const network = Network.from(config.chainId);
// ethers polls for receipts every 4 s by default; a local node mines instantly, so 1 s keeps the
// "Pending" toast in step with the data (ISSUE-007).
export const POLLING_MS = 1000;
export const readProvider = new JsonRpcProvider(RPC_URL, network, { staticNetwork: network, pollingInterval: POLLING_MS });

export const auctionIface = new Interface(config.auction.abi);
export const readAuction = new Contract(config.auction.address, config.auction.abi, readProvider);
export const readToken = new Contract(config.token.address, config.token.abi, readProvider);

/** Contract instances that send transactions through `signer`. */
export function writeContracts(signer) {
  return {
    auction: new Contract(config.auction.address, config.auction.abi, signer),
    token: new Contract(config.token.address, config.token.abi, signer),
  };
}
