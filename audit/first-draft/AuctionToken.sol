// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/// @title AuctionToken
/// @notice ERC20 sold in the Dutch auction. The whole supply is minted once, to the auction,
///         in the constructor. Burnable so unsold tokens can be permanently removed.
contract AuctionToken is ERC20, ERC20Burnable {
    constructor(string memory name_, string memory symbol_, address holder, uint256 supply) ERC20(name_, symbol_) {
        _mint(holder, supply);
    }
}
