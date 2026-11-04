// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IDutchAuction
/// @notice Interface for the 20-minute Dutch auction. Frontend and tests build against this.
/// @dev Keep in sync with DESIGN.md. Changes need agreement from all three team members.
interface IDutchAuction {
    // ---------------------------------------------------------------
    // Errors
    // ---------------------------------------------------------------
    error InvalidParams();
    error NotSeller();
    error AlreadyStarted();
    error AuctionNotStarted();
    error AuctionNotActive();
    error AuctionNotEnded();
    error AuctionAlreadyFinalized();
    error AuctionNotFinalized();
    error NothingToClaim();
    error ZeroBid();
    error TransferFailed();

    // ---------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------
    event AuctionStarted(uint256 startTime, uint256 endTime);
    event BidPlaced(address indexed bidder, uint256 amountAccepted, uint256 amountRefundable, uint256 priceAtBid);
    event AuctionCleared(uint256 clearingPrice, uint256 totalCommitted);
    event AuctionFinalized(uint256 clearingPrice, uint256 tokensSold, uint256 tokensBurned);
    event Claimed(address indexed bidder, uint256 tokensReceived, uint256 ethRefunded);
    event ProceedsWithdrawn(address indexed seller, uint256 amount);
    event RefundDeferred(address indexed bidder, uint256 amount);
    event RefundWithdrawn(address indexed bidder, address indexed to, uint256 amount);

    // ---------------------------------------------------------------
    // Actions
    // ---------------------------------------------------------------

    /// @notice Start the auction clock. Seller only, callable once.
    function start() external;

    /// @notice Commit ETH at the current price. Bids accumulate per address.
    /// @dev If this bid pushes demand past supply, only the needed portion is accepted,
    ///      the auction sells out at the current price and the rest is refundable at claim().
    function bid() external payable;

    /// @notice Settle the auction: fix clearingPrice and burn unsold tokens. Anyone may call, once.
    function finalize() external;

    /// @notice Pull tokens and ETH refund for msg.sender. Only after finalize().
    function claim() external;

    /// @notice Settle `bidder`'s claim on their behalf. Tokens and refund go to `bidder`, not the caller.
    function claimFor(address bidder) external;

    /// @notice Withdraw a refund that could not be delivered during claim, to any address.
    function withdrawRefund(address payable to) external;

    /// @notice Seller withdraws proceeds accrued from claims. Only after finalize().
    function withdrawProceeds() external;

    // ---------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------

    /// @notice Current price in wei per whole token (1e18 units). Floors at reservePrice.
    function currentPrice() external view returns (uint256);

    /// @notice Seconds remaining until endTime (full duration before start, 0 once ended).
    function timeRemaining() external view returns (uint256);

    /// @notice Total ETH accepted so far.
    function totalCommitted() external view returns (uint256);

    /// @notice ETH committed by a given bidder (before claim).
    function bids(address bidder) external view returns (uint256);

    /// @notice Final uniform price. Zero until the auction sells out or is finalized.
    function clearingPrice() external view returns (uint256);

    /// @notice Refund held for a bidder because it could not be delivered during claim.
    function pendingRefund(address bidder) external view returns (uint256);

    /// @notice Tokens a bidder would receive at claim time (0 before finalize).
    function tokensFor(address bidder) external view returns (uint256);

    /// @notice ETH a bidder would be refunded at claim time (0 before finalize).
    function refundFor(address bidder) external view returns (uint256);

    function startTime() external view returns (uint256);
    function endTime() external view returns (uint256);
    function startPrice() external view returns (uint256);
    function reservePrice() external view returns (uint256);
    function tokenSupply() external view returns (uint256);
    function finalized() external view returns (bool);
}
