// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title eRWF
 * @notice Simulated Rwanda Franc token for escrow system
 * @dev ERC-20 token with controlled minting/burning, designed as drop-in replacement
 * for BNR's future programmable e-Franc CBDC. Users can freely transfer tokens.
 */
contract eRWF is ERC20, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /**
     * @notice Constructor sets up the token
     * @param operator Address to be granted OPERATOR_ROLE (backend relay wallet)
     */
    constructor(address operator) ERC20("Simulated Rwanda Franc", "eRWF") {
        require(operator != address(0), "Invalid operator address");
        _grantRole(OPERATOR_ROLE, operator);
        // Grant DEFAULT_ADMIN_ROLE to operator so they can manage roles if needed
        _grantRole(DEFAULT_ADMIN_ROLE, operator);
    }

    /**
     * @notice Mints eRWF tokens - only callable by OPERATOR_ROLE
     * @param to Recipient address
     * @param amount Amount to mint (18 decimals)
     */
    function mint(address to, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(to != address(0), "eRWF: mint to zero address");
        require(amount > 0, "eRWF: mint amount must be positive");
        _mint(to, amount);
    }

    /**
     * @notice Burns eRWF tokens - only callable by OPERATOR_ROLE
     * @param from Address to burn from
     * @param amount Amount to burn
     */
    function burn(address from, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(from != address(0), "eRWF: burn from zero address");
        require(amount > 0, "eRWF: burn amount must be positive");
        _burn(from, amount);
    }

    /**
     * @notice Standard ERC20 transfer - users can freely transfer eRWF
     * @dev Allows eRWF to be used for any purpose, not just escrow
     */
    function transfer(address to, uint256 amount) public override returns (bool) {
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return true;
    }

    /**
     * @notice Standard ERC20 transferFrom - allows approved transfers
     * @dev Used by escrow contract and any other approved spender
     */
    function transferFrom(address from, address to, uint256 amount) 
        public 
        override 
        returns (bool) 
    {
        address spender = _msgSender();
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }
}
