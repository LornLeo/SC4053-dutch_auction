// Smoke tests written by the AI alongside the first draft. Quick sanity checks only.
// B owns the full test suite (DESIGN.md section 11).
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const E = ethers.parseEther;
const MIN = 60;

async function deploy() {
  const [seller, alice, bob, carol] = await ethers.getSigners();
  const Auction = await ethers.getContractFactory("DutchAuction");
  const auction = await Auction.deploy("Auction Token", "AUC", E("1000"), E("1"), E("0.1"));
  const token = await ethers.getContractAt("AuctionToken", await auction.token());
  return { auction, token, seller, alice, bob, carol };
}

describe("DutchAuction (smoke)", () => {
  it("rejects bids before start and non-seller start", async () => {
    const { auction, alice } = await loadFixture(deploy);
    await expect(auction.connect(alice).bid({ value: E("1") })).to.be.revertedWithCustomError(auction, "AuctionNotStarted");
    await expect(auction.connect(alice).start()).to.be.revertedWithCustomError(auction, "NotSeller");
  });

  it("price decays linearly and floors at reserve", async () => {
    const { auction } = await loadFixture(deploy);
    await auction.start();
    expect(await auction.currentPrice()).to.equal(E("1"));
    await time.increase(10 * MIN - 1); // next block lands at exactly +10 min
    expect(await auction.currentPrice()).to.be.closeTo(E("0.55"), E("0.001"));
    await time.increase(11 * MIN);
    expect(await auction.currentPrice()).to.equal(E("0.1"));
  });

  it("crossing bid: partial fill, uniform price, refund, burn, proceeds", async () => {
    const { auction, token, seller, alice, bob } = await loadFixture(deploy);
    await auction.start();
    await auction.connect(alice).bid({ value: E("600") });
    await auction.connect(bob).bid({ value: E("600") }); // only ~400 accepted at ~1 ETH
    expect(await auction.soldOut()).to.equal(true);
    const cp = await auction.clearingPrice();
    await expect(auction.connect(alice).claim()).to.be.revertedWithCustomError(auction, "AuctionNotFinalized");
    await auction.finalize();
    await auction.connect(alice).claim();
    await auction.connect(bob).claim();
    const supplyOut = (await token.balanceOf(alice.address)) + (await token.balanceOf(bob.address));
    expect(supplyOut).to.be.lte(E("1000"));
    expect(await token.totalSupply()).to.be.lte(E("1000"));
    // conservation: contract keeps exactly the proceeds
    const proceeds = await auction.proceeds();
    expect(await ethers.provider.getBalance(await auction.getAddress())).to.equal(proceeds);
    await auction.connect(seller).withdrawProceeds();
    expect(await ethers.provider.getBalance(await auction.getAddress())).to.equal(0n);
    await expect(auction.connect(alice).claim()).to.be.revertedWithCustomError(auction, "NothingToClaim");
    expect(cp).to.be.gt(0n);
  });

  it("never sells out: reserve price, unsold tokens burned", async () => {
    const { auction, token, alice } = await loadFixture(deploy);
    await auction.start();
    await auction.connect(alice).bid({ value: E("10") });
    await expect(auction.finalize()).to.be.revertedWithCustomError(auction, "AuctionNotEnded");
    await time.increase(20 * MIN);
    await auction.finalize();
    expect(await auction.clearingPrice()).to.equal(E("0.1"));
    expect(await token.totalSupply()).to.equal(E("100")); // 10 ETH / 0.1 = 100 tokens, 900 burned
    await auction.connect(alice).claim();
    expect(await token.balanceOf(alice.address)).to.equal(E("100"));
    await expect(auction.finalize()).to.be.revertedWithCustomError(auction, "AuctionAlreadyFinalized");
  });

  it("lazy clear: demand meets supply between bids", async () => {
    const { auction, token, alice, bob } = await loadFixture(deploy);
    await auction.start();
    await auction.connect(alice).bid({ value: E("500") });
    await time.increase(15 * MIN); // price ~0.25, so demand 500/0.25 > supply
    await expect(auction.connect(bob).bid({ value: E("1") })).to.be.revertedWithCustomError(auction, "AuctionNotActive");
    await time.increase(6 * MIN);
    await auction.finalize();
    expect(await auction.clearingPrice()).to.equal(E("0.5")); // committed / supply
    await auction.connect(alice).claim();
    expect(await token.balanceOf(alice.address)).to.equal(E("1000"));
  });

  it("reentrancy attacker cannot claim twice", async () => {
    const { auction, token, alice } = await loadFixture(deploy);
    const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
    const attacker = await Attacker.deploy(await auction.getAddress());
    await auction.start();
    await auction.connect(alice).bid({ value: E("600") });
    await attacker.placeBid({ value: E("600") }); // crossing bid, creates a refund
    await auction.finalize();
    const before = await ethers.provider.getBalance(await attacker.getAddress());
    const owed = await auction.refundFor(await attacker.getAddress());
    await attacker.attackClaim();
    const gained = (await ethers.provider.getBalance(await attacker.getAddress())) - before;
    expect(await attacker.reentryAttempts()).to.equal(1n);
    expect(await attacker.reentrySucceeded()).to.equal(false);
    expect(gained).to.equal(owed); // received exactly its refund, nothing more
    await auction.connect(alice).claim();
    expect(await token.totalSupply()).to.be.lte(E("1000"));
  });
});
