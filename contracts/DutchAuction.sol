// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IDutchAuction} from "./IDutchAuction.sol";
import {AuctionToken} from "./AuctionToken.sol";

/// @title DutchAuction
/// @notice 20-minute descending-price auction with a uniform clearing price.
///         See SPEC.md and DESIGN.md. Units: tokens in base units (1e18 = 1 token),
///         ETH in wei, prices in wei per whole token.
contract DutchAuction is IDutchAuction, ReentrancyGuard {
    uint256 public constant DURATION = 20 minutes;
    uint256 private constant UNIT = 1e18;

    address public immutable seller;
    AuctionToken public immutable token;
    uint256 public immutable override tokenSupply;
    uint256 public immutable override startPrice;
    uint256 public immutable override reservePrice;

    uint256 public override startTime;
    uint256 public override endTime;

    uint256 public override totalCommitted;
    mapping(address => uint256) public override bids;
    mapping(address => uint256) public excess; // surplus ETH from the crossing bid
    mapping(address => uint256) public override pendingRefund; // refunds that could not be delivered at claim time

    bool public soldOut;
    bool public override finalized;
    uint256 public override clearingPrice;
    uint256 public tokensSold;
    uint256 public proceeds; // accrued in claim(), withdrawn by seller

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply_,
        uint256 startPrice_,
        uint256 reservePrice_
    ) {
        if (supply_ == 0 || reservePrice_ == 0 || startPrice_ <= reservePrice_) revert InvalidParams();
        seller = msg.sender;
        tokenSupply = supply_;
        startPrice = startPrice_;
        reservePrice = reservePrice_;
        token = new AuctionToken(name_, symbol_, address(this), supply_);
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    function start() external override {
        if (msg.sender != seller) revert NotSeller();
        if (startTime != 0) revert AlreadyStarted();
        startTime = block.timestamp;
        endTime = block.timestamp + DURATION;
        emit AuctionStarted(startTime, endTime);
    }

    function bid() external payable override nonReentrant {
        if (msg.value == 0) revert ZeroBid();
        if (startTime == 0) revert AuctionNotStarted();
        if (block.timestamp >= endTime || soldOut) revert AuctionNotActive();

        uint256 p = currentPrice();
        uint256 maxCommit = (tokenSupply * p) / UNIT; // ETH needed to buy the whole supply at p
        // Demand already meets supply at the current price (price fell between bids).
        if (totalCommitted >= maxCommit) revert AuctionNotActive();

        uint256 accepted = msg.value;
        uint256 refundable = 0;
        if (totalCommitted + msg.value >= maxCommit) {
            // Crossing bid: accept only what is needed to sell out, rest is refundable at claim.
            accepted = maxCommit - totalCommitted;
            refundable = msg.value - accepted;
            excess[msg.sender] += refundable;
            soldOut = true;
            clearingPrice = p;
            emit AuctionCleared(p, totalCommitted + accepted);
        }

        bids[msg.sender] += accepted;
        totalCommitted += accepted;
        emit BidPlaced(msg.sender, accepted, refundable, p);
    }

    function finalize() external override nonReentrant {
        if (startTime == 0) revert AuctionNotStarted();
        if (finalized) revert AuctionAlreadyFinalized();
        if (!soldOut && block.timestamp < endTime) revert AuctionNotEnded();

        if (!soldOut) {
            // Not cleared by a crossing bid: either never sold out (reserve price) or demand met
            // supply between bids at price committed / supply (rounded up so claims never exceed supply).
            uint256 impliedPrice = (totalCommitted * UNIT + tokenSupply - 1) / tokenSupply;
            clearingPrice = impliedPrice > reservePrice ? impliedPrice : reservePrice;
        }

        uint256 sold = (totalCommitted * UNIT) / clearingPrice;
        if (sold > tokenSupply) sold = tokenSupply;
        tokensSold = sold;
        finalized = true;

        uint256 burned = tokenSupply - sold;
        if (burned > 0) token.burn(burned);

        emit AuctionFinalized(clearingPrice, sold, burned);
    }

    function claim() external override nonReentrant {
        _claim(msg.sender);
    }

    /// @notice Settle a bidder's claim on their behalf. Tokens and refund always go to `bidder`,
    ///         never to the caller, so anyone (e.g. the seller) can trigger it. This stops a bidder who
    ///         never claims from locking the seller's proceeds (ISSUE-003).
    function claimFor(address bidder) external override nonReentrant {
        _claim(bidder);
    }

    function _claim(address bidder) internal {
        if (!finalized) revert AuctionNotFinalized();

        uint256 committed = bids[bidder];
        uint256 surplus = excess[bidder];
        if (committed == 0 && surplus == 0) revert NothingToClaim();

        uint256 tokens = (committed * UNIT) / clearingPrice; // rounds down
        uint256 cost = (tokens * clearingPrice) / UNIT; // rounds down
        uint256 refund = committed - cost + surplus;

        // Effects before interactions.
        bids[bidder] = 0;
        excess[bidder] = 0;
        proceeds += cost;

        if (tokens > 0) {
            bool ok = token.transfer(bidder, tokens);
            if (!ok) revert TransferFailed();
        }

        uint256 refundPaid = 0;
        if (refund > 0) {
            (bool sent, ) = bidder.call{value: refund}("");
            if (sent) {
                refundPaid = refund;
            } else {
                // A refund that cannot be delivered must not block the tokens (ISSUE-004):
                // hold it for the bidder to withdraw, possibly to a different address.
                pendingRefund[bidder] += refund;
                emit RefundDeferred(bidder, refund);
            }
        }
        emit Claimed(bidder, tokens, refundPaid);
    }

    /// @notice Withdraw a refund that could not be delivered during claim, to any address.
    function withdrawRefund(address payable to) external override nonReentrant {
        if (to == address(0)) revert InvalidParams();
        uint256 amount = pendingRefund[msg.sender];
        if (amount == 0) revert NothingToClaim();

        pendingRefund[msg.sender] = 0;
        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit RefundWithdrawn(msg.sender, to, amount);
    }

    function withdrawProceeds() external override nonReentrant {
        if (msg.sender != seller) revert NotSeller();
        if (!finalized) revert AuctionNotFinalized();

        uint256 amount = proceeds;
        proceeds = 0;
        (bool sent, ) = seller.call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit ProceedsWithdrawn(seller, amount);
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    function currentPrice() public view override returns (uint256) {
        if (startTime == 0) return startPrice;
        if (block.timestamp >= endTime) return reservePrice;
        uint256 elapsed = block.timestamp - startTime;
        return startPrice - ((startPrice - reservePrice) * elapsed) / DURATION;
    }

    function timeRemaining() external view override returns (uint256) {
        if (startTime == 0) return DURATION;
        if (block.timestamp >= endTime) return 0;
        return endTime - block.timestamp;
    }

    function tokensFor(address bidder) external view override returns (uint256) {
        if (!finalized) return 0;
        return (bids[bidder] * UNIT) / clearingPrice;
    }

    function refundFor(address bidder) external view override returns (uint256) {
        if (!finalized) return 0;
        uint256 committed = bids[bidder];
        uint256 tokens = (committed * UNIT) / clearingPrice;
        uint256 cost = (tokens * clearingPrice) / UNIT;
        return committed - cost + excess[bidder];
    }
}
