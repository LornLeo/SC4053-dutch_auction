const fs = require("fs");
const path = require("path");

// Writes the deployed addresses and ABIs to frontend/src/contracts.json so the web app
// always talks to the contracts that were just deployed. Called by deploy.js and seed.js.
async function exportToFrontend(hre, auction) {
  const auctionArtifact = await hre.artifacts.readArtifact("DutchAuction");
  const tokenArtifact = await hre.artifacts.readArtifact("AuctionToken");
  const network = await hre.ethers.provider.getNetwork();
  const receipt = await auction.deploymentTransaction().wait();

  const out = {
    chainId: Number(network.chainId),
    deployBlock: receipt.blockNumber,
    auction: { address: await auction.getAddress(), abi: auctionArtifact.abi },
    token: { address: await auction.token(), abi: tokenArtifact.abi },
  };

  const file = path.join(__dirname, "..", "frontend", "src", "contracts.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log("Frontend config written to frontend/src/contracts.json");
}

module.exports = { exportToFrontend };
