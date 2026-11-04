const hre = require("hardhat");
const { exportToFrontend } = require("./exportFrontend");
const E = hre.ethers.parseEther;

// Demo helper: deploy, start the auction and place bids from several accounts.
//   npx hardhat node
//   npx hardhat run scripts/seed.js --network localhost
// The last bid crosses the sell-out threshold. Afterwards call finalize() and claim() from the UI.
async function main() {
  const [seller, alice, bob, carol] = await hre.ethers.getSigners();
  const Auction = await hre.ethers.getContractFactory("DutchAuction");
  const auction = await Auction.deploy("Auction Token", "AUC", E("1000"), E("1"), E("0.1"));
  await auction.waitForDeployment();
  console.log("DutchAuction:", await auction.getAddress());
  console.log("AuctionToken:", await auction.token());
  await exportToFrontend(hre, auction);

  await (await auction.start()).wait();
  console.log("Auction started");

  const plan = [
    [alice, "300"],
    [bob, "250"],
    [carol, "600"], // 300 + 250 + 600 > ~1000 ETH needed at the current price, so this bid is partly refunded
  ];
  for (const [signer, eth] of plan) {
    try {
      await (await auction.connect(signer).bid({ value: E(eth) })).wait();
      console.log(`${signer.address} bid ${eth} ETH, price now ${hre.ethers.formatEther(await auction.currentPrice())}`);
    } catch (e) {
      console.log(`${signer.address} bid failed: ${e.shortMessage || e.message}`);
    }
  }
  console.log("Sold out:", await auction.soldOut(), "| clearing price:", hre.ethers.formatEther(await auction.clearingPrice()));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
