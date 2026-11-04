const hre = require("hardhat");
const { exportToFrontend } = require("./exportFrontend");
const E = hre.ethers.parseEther;

// Deploys a DutchAuction locally and prints addresses. Run a local node first:
//   npx hardhat node
//   npx hardhat run scripts/deploy.js --network localhost
async function main() {
  const [seller] = await hre.ethers.getSigners();
  const Auction = await hre.ethers.getContractFactory("DutchAuction");
  const auction = await Auction.deploy("Auction Token", "AUC", E("1000"), E("1"), E("0.1"));
  await auction.waitForDeployment();
  const token = await auction.token();
  console.log("Seller:        ", seller.address);
  console.log("DutchAuction:  ", await auction.getAddress());
  console.log("AuctionToken:  ", token);
  await exportToFrontend(hre, auction);
  console.log("Call start() to begin the 20-minute clock (scripts/seed.js does this for the demo).");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
