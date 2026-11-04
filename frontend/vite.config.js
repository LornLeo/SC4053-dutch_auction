import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The local Hardhat node is proxied at /rpc so the browser reads chain data without CORS issues.
const rpcProxy = {
  "/rpc": {
    target: process.env.HARDHAT_RPC || "http://127.0.0.1:8545",
    changeOrigin: true,
    rewrite: () => "/",
  },
};

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: rpcProxy },
  preview: { port: 4173, proxy: rpcProxy },
});
