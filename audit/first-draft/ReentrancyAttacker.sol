// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDutchAuction} from "./IDutchAuction.sol";

/// @title ReentrancyAttacker
/// @notice Bonus demo. A bidder contract that tries to re-enter claim() while its refund is
///         being paid. The auction should block the re-entry (nonReentrant, and balances are
///         zeroed before the transfer), so the attacker only ever receives its legitimate refund.
contract ReentrancyAttacker {
    IDutchAuction public immutable auction;
    uint256 public reentryAttempts;
    bool public reentrySucceeded;

    constructor(address auction_) {
        auction = IDutchAuction(auction_);
    }

    function placeBid() external payable {
        auction.bid{value: msg.value}();
    }

    function attackClaim() external {
        auction.claim();
    }

    receive() external payable {
        reentryAttempts += 1;
        try auction.claim() {
            reentrySucceeded = true;
        } catch {
            // blocked, as expected
        }
    }
}
