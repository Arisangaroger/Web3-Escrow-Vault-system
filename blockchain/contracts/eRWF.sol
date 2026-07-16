// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title eRWF
 * @notice Simulated Rwanda Franc for the escrow system
 * @dev No user-side approve/permit needed for escrow: after Escrow verifies a
 *      meta-tx signature, Escrow (ESCROW_ROLE) pulls tokens with pullFrom.
 *      Users never send native-gas txs; the relay submits everything.
 */
contract eRWF is ERC20, AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    /// @dev Granted only to the Escrow contract — can move tokens after Escrow auth
    bytes32 public constant ESCROW_ROLE = keccak256("ESCROW_ROLE");

    constructor(address operator) ERC20("Simulated Rwanda Franc", "eRWF") {
        require(operator != address(0), "Invalid operator address");
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(DEFAULT_ADMIN_ROLE, operator);
    }

    function mint(address to, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(to != address(0), "eRWF: mint to zero address");
        require(amount > 0, "eRWF: mint amount must be positive");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        require(from != address(0), "eRWF: burn from zero address");
        require(amount > 0, "eRWF: burn amount must be positive");
        _burn(from, amount);
    }

    /**
     * @notice Escrow-only pull after Escrow has verified the owner's meta-tx signature.
     * @param from Token owner (deal receiver)
     * @param amount Amount to move into Escrow (msg.sender must be the Escrow contract)
     */
    function pullFrom(address from, uint256 amount) external onlyRole(ESCROW_ROLE) {
        require(from != address(0), "eRWF: pull from zero");
        require(amount > 0, "eRWF: pull amount must be positive");
        _transfer(from, msg.sender, amount);
    }
}
