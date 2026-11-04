// Regression tests for the fixes to ISSUE-003 and ISSUE-004 (see AI_AUDIT.md section 5).
// Before the fixes these tests asserted the problem (funds stranded, claim reverting);
// the "before" output is saved in audit/test-output-before-fix.txt.
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const E = ethers.parseEther;

async function deploy() {
  const [seller, alice, bob, carol, keeper] = await ethers.getSigners();
  const Auction = await ethers.getContractFactory("DutchAuction");
  const auction = await Auction.deploy("Auction Token", "AUC", E("1000"), E("1"), E("0.1"));
  const token = await ethers.getContractAt("AuctionToken", await auction.token());
  return { auction, token, seller, alice, bob, carol, keeper };
}

// alice bids 600, bob's 600 crosses the threshold, then the auction is finalized.
async function soldOut(f) {
  await f.auction.start();
  await f.auction.connect(f.alice).bid({ value: E("600") });
  await f.auction.connect(f.bob).bid({ value: E("600") });
  await f.auction.finalize();
}

describe("ISSUE-003 fix: claimFor lets anyone settle a bidder who never claims", () => {
  it("a third party can settle bob; the seller then receives everything and the contract is empty", async () => {
    const f = await loadFixture(deploy);
    const { auction, token, seller, alice, bob, keeper } = f;
    await soldOut(f);

    await auction.connect(alice).claim(); // alice claims herself, bob never acts
    const bobEthBefore = await ethers.provider.getBalance(bob.address);
    await auction.connect(keeper).claimFor(bob.address); // someone else settles bob

    expect(await token.balanceOf(bob.address)).to.be.gt(0n); // tokens go to bob, not to the keeper
    expect(await token.balanceOf(keeper.address)).to.equal(0n);
    expect((await ethers.provider.getBalance(bob.address)) - bobEthBefore).to.be.gt(0n); // bob's refund reaches bob

    await auction.connect(seller).withdrawProceeds();
    expect(await ethers.provider.getBalance(await auction.getAddress())).to.equal(0n); // nothing stranded
  });

  it("claimFor cannot settle the same bidder twice, nor before finalize", async () => {
    const f = await loadFixture(deploy);
    const { auction, bob, keeper } = f;
    await auction.start();
    await auction.connect(bob).bid({ value: E("10") });
    await expect(auction.connect(keeper).claimFor(bob.address)).to.be.revertedWithCustomError(auction, "AuctionNotFinalized");
    await time.increase(20 * 60 + 1);
    await auction.finalize();
    await auction.connect(keeper).claimFor(bob.address);
    await expect(auction.connect(keeper).claimFor(bob.address)).to.be.revertedWithCustomError(auction, "NothingToClaim");
  });

  it("claimFor for an address with no bid reverts", async () => {
    const f = await loadFixture(deploy);
    await soldOut(f);
    await expect(f.auction.connect(f.keeper).claimFor(f.carol.address)).to.be.revertedWithCustomError(f.auction, "NothingToClaim");
  });
});

describe("ISSUE-004 fix: an undeliverable refund no longer blocks the tokens", () => {
  async function withContractBidder(f) {
    const Bidder = await ethers.getContractFactory("NoReceiveBidder");
    const bidder = await Bidder.deploy(await f.auction.getAddress());
    await f.auction.start();
    await f.auction.connect(f.alice).bid({ value: E("600") });
    await bidder.placeBid({ value: E("600") }); // crossing bid creates a refund the contract cannot receive
    await f.auction.finalize();
    return bidder;
  }

  it("claim succeeds: tokens are delivered and the refund is held as pendingRefund", async () => {
    const f = await loadFixture(deploy);
    const { auction, token } = f;
    const bidder = await withContractBidder(f);
    const addr = await bidder.getAddress();

    await expect(bidder.claim()).to.emit(auction, "RefundDeferred");
    expect(await token.balanceOf(addr)).to.be.gt(0n); // tokens delivered
    expect(await auction.pendingRefund(addr)).to.be.gt(0n); // refund held
    expect(await auction.bids(addr)).to.equal(0n);
  });

  it("the contract bidder can recover its refund by sending it to another address", async () => {
    const f = await loadFixture(deploy);
    const { auction, carol } = f;
    const bidder = await withContractBidder(f);
    const addr = await bidder.getAddress();
    await bidder.claim();

    const held = await auction.pendingRefund(addr);
    const before = await ethers.provider.getBalance(carol.address);
    await bidder.withdrawRefundTo(carol.address);
    expect((await ethers.provider.getBalance(carol.address)) - before).to.equal(held);
    expect(await auction.pendingRefund(addr)).to.equal(0n);
    await expect(bidder.withdrawRefundTo(carol.address)).to.be.revertedWithCustomError(auction, "NothingToClaim");
  });

  it("a third party settling a contract bidder does not revert (no griefing of the keeper)", async () => {
    const f = await loadFixture(deploy);
    const { auction, token, keeper } = f;
    const bidder = await withContractBidder(f);
    await auction.connect(keeper).claimFor(await bidder.getAddress());
    expect(await token.balanceOf(await bidder.getAddress())).to.be.gt(0n);
  });

  it("withdrawRefund rejects the zero address and callers with nothing pending", async () => {
    const f = await loadFixture(deploy);
    const { auction, alice } = f;
    await soldOut(f);
    await expect(auction.connect(alice).withdrawRefund(ethers.ZeroAddress)).to.be.revertedWithCustomError(auction, "InvalidParams");
    await expect(auction.connect(alice).withdrawRefund(alice.address)).to.be.revertedWithCustomError(auction, "NothingToClaim");
  });

  it("solvency: after everyone is settled and funds withdrawn the contract holds 0 ETH", async () => {
    const f = await loadFixture(deploy);
    const { auction, seller, alice, carol } = f;
    const bidder = await withContractBidder(f);
    await auction.connect(alice).claim();
    await bidder.claim();
    await bidder.withdrawRefundTo(carol.address);
    await auction.connect(seller).withdrawProceeds();
    expect(await ethers.provider.getBalance(await auction.getAddress())).to.equal(0n);
  });
});
