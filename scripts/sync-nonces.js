const hre = require("hardhat");

// Local development helper: stops MetaMask's "Nonce too high" error after `npx hardhat node` restarts.
//
// MetaMask remembers the transactions it sent from each account and uses
//   next nonce = max(nonce reported by the chain, highest nonce it remembers + 1).
// A restarted node starts every account at 0 again, so MetaMask's remembered number is too high.
// This script raises each test account's nonce on the LOCAL node to "seconds since 2026-01-01",
// which is higher than anything sent before and keeps growing across restarts, so MetaMask
// always uses the chain's number. It then mines one block so MetaMask's per-block RPC cache
// is refreshed. Run it after deploying:
//   npx hardhat run scripts/sync-nonces.js --network localhost
const EPOCH = Date.UTC(2026, 0, 1) / 1000;
const ACCOUNTS = 10; // test accounts #0..#9

async function main() {
  const { chainId } = await hre.ethers.provider.getNetwork();
  if (chainId !== 31337n) throw new Error(`Refusing to run on chain ${chainId}: local Hardhat node (31337) only.`);

  const target = Math.floor(Date.now() / 1000) - EPOCH;
  const signers = (await hre.ethers.getSigners()).slice(0, ACCOUNTS);
  for (const [i, s] of signers.entries()) {
    const current = await hre.ethers.provider.getTransactionCount(s.address);
    if (current < target) {
      await hre.network.provider.send("hardhat_setNonce", [s.address, "0x" + target.toString(16)]);
    }
    console.log(`#${i} ${s.address} nonce ${current} -> ${Math.max(current, target)}`);
  }
  // hardhat_setNonce does not mine a block, and MetaMask caches RPC answers per block number, so it
  // kept using the nonce it had cached for the current block ("Nonce too low ... got 9").
  // Mining one empty block makes MetaMask fetch the new nonce.
  await hre.network.provider.send("evm_mine");
  console.log(`Mined block ${await hre.ethers.provider.getBlockNumber()} so MetaMask refreshes its cached nonce.`);
  console.log("Done. Reload the dApp page, then send the transaction again.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
