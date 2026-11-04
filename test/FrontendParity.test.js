const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Frontend <-> contract parity (prompt R2/R6): the numbers the UI shows come from
// frontend/src/lib/auctionMath.js. These tests run that same code against the real contract
// at exact block timestamps, so a UI formula that drifts from the Solidity one fails here.
const E = ethers.parseEther;

describe("Frontend maths parity with DutchAuction", function () {
  let m; // frontend/src/lib/auctionMath.js (ESM)
  before(async function () {
    m = await import("../frontend/src/lib/auctionMath.js");
  });

  async function deploy() {
    const [seller, a, b, c] = await ethers.getSigners();
    const Auction = await ethers.getContractFactory("DutchAuction");
    const auction = await Auction.deploy("Auction Token", "AUC", E("1000"), E("1"), E("0.1"));
    return { auction, seller, a, b, c };
  }

  async function view(auction) {
    return {
      startPrice: await auction.startPrice(),
      reservePrice: await auction.reservePrice(),
      tokenSupply: await auction.tokenSupply(),
      startTime: await auction.startTime(),
      endTime: await auction.endTime(),
      totalCommitted: await auction.totalCommitted(),
      soldOut: await auction.soldOut(),
      finalized: await auction.finalized(),
    };
  }

  it("priceAt() equals currentPrice() at every sampled block timestamp", async function () {
    const { auction } = await deploy();
    await auction.start();
    const start = await auction.startTime();
    for (const dt of [0n, 1n, 7n, 600n, 1199n, 1200n, 1500n]) {
      if (dt > 0n) await time.increaseTo(start + dt);
      const v = await view(auction);
      const now = BigInt(await time.latest());
      expect(m.priceAt(v, now)).to.equal(await auction.currentPrice(), `t=${dt}`);
      expect(m.timeLeft(v, now)).to.equal(await auction.timeRemaining(), `t=${dt}`);
    }
  });

  it("bidEstimate() at the mining timestamp predicts BidPlaced exactly for a crossing bid", async function () {
    const { auction, a, b } = await deploy();
    await auction.start();
    await auction.connect(a).bid({ value: E("500") });

    const start = await auction.startTime();
    const minedAt = start + 120n; // the price a bid pays is set by the block it is mined in
    await time.setNextBlockTimestamp(minedAt);
    const v = await view(auction);
    const price = m.priceAt(v, minedAt);
    const est = m.bidEstimate(v, E("600"), price);

    await expect(auction.connect(b).bid({ value: E("600") }))
      .to.emit(auction, "BidPlaced")
      .withArgs(b.address, est.accepted, est.refundable, price);
    expect(est.partial).to.equal(true);
    expect(await auction.soldOut()).to.equal(true);
  });

  it("claimPreview() equals tokensFor()/refundFor() for every bidder after finalize", async function () {
    const { auction, a, b, c } = await deploy();
    await auction.start();
    await auction.connect(a).bid({ value: E("300") });
    await auction.connect(b).bid({ value: 1234567n }); // odd wei amount for rounding
    await auction.connect(c).bid({ value: E("700") }); // crosses
    await auction.finalize();
    const clearing = await auction.clearingPrice();
    for (const s of [a, b, c]) {
      const p = m.claimPreview(await auction.bids(s.address), await auction.excess(s.address), clearing);
      expect(p.tokens).to.equal(await auction.tokensFor(s.address));
      expect(p.refund).to.equal(await auction.refundFor(s.address));
    }
  });

  it("expectedClearingPrice() before finalize equals clearingPrice() after (lazy clear and no sell-out)", async function () {
    for (const committed of [E("500"), E("50"), 1234567n]) {
      const { auction, a } = await deploy();
      await auction.start();
      await auction.connect(a).bid({ value: committed });
      await time.increaseTo((await auction.startTime()) + 1200n);
      const v = { ...(await view(auction)), clearingPrice: await auction.clearingPrice() };
      const expected = m.expectedClearingPrice(v);
      await auction.finalize();
      expect(await auction.clearingPrice()).to.equal(expected);
    }
  });

  it("'Demand met' status matches the contract: bid() and finalize() both revert", async function () {
    const { auction, a, b } = await deploy();
    await auction.start();
    await auction.connect(a).bid({ value: E("500") });
    const start = await auction.startTime();
    await time.increaseTo(start + 700n); // price 0.475 -> 500 ETH already buys 1000 tokens
    const v = await view(auction);
    expect(m.deriveStatus(v, BigInt(await time.latest()))).to.equal(m.Status.DEMAND_MET);
    expect(m.canFinalize(m.Status.DEMAND_MET)).to.equal(false);
    await expect(auction.connect(b).bid({ value: E("1") })).to.be.revertedWithCustomError(auction, "AuctionNotActive");
    await expect(auction.finalize()).to.be.revertedWithCustomError(auction, "AuctionNotEnded");
  });
});
