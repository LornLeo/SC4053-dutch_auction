const hre = require("hardhat");

// Local development helper: stops MetaMask's "Nonce too high" error after `npx hardhat node` restarts.
//
// MetaMask remembers the transactions it sent from each account and uses
//   next nonce = max(nonce reported by the chain, highest nonce it remembers + 1).
// A restarted node starts every account at 0 again, so MetaMask's remembered number is too high.
// This script raises each test account's nonce on the LOCAL node to "seconds since 2026-01-01",
// which is higher than anything sent before and keeps growing across restarts, so MetaMask
// always uses the chain's number. Run it after deploying:
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
  console.log("Done. MetaMask will now use the chain's nonce for these accounts.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
