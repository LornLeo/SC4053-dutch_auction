// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDutchAuction} from "../IDutchAuction.sol";

/// @title NoReceiveBidder
/// @notice Test helper. A contract bidder with no receive()/fallback, so it cannot accept ETH.
///         Used to show what happens when a refund cannot be delivered to a bidder.
contract NoReceiveBidder {
    IDutchAuction public immutable auction;

    constructor(address auction_) {
        auction = IDutchAuction(auction_);
    }

    function placeBid() external payable {
        auction.bid{value: msg.value}();
    }

    function claim() external {
        auction.claim();
    }

    /// @notice Lets the contract recover a deferred refund by sending it to another address.
    function withdrawRefundTo(address payable to) external {
        auction.withdrawRefund(to);
    }
}
