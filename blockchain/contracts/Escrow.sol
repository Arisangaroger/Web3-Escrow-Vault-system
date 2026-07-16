// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "./eRWF.sol";

/**
 * @title Escrow
 * @notice Agricultural trade escrow with meta-transactions (no ERC-2771 forwarder).
 * @dev Architecture:
 *      - RELAY_ROLE pays gas and is the only msg.sender for party actions.
 *      - Caller identity is established by _verifySigner (EIP-712 + per-user nonce).
 *      - Token lock uses eRWF.pullFrom (ESCROW_ROLE) — no approve/permit from users.
 *      - Keeper actions (autoCancel / releaseFunds) stay permissionless.
 */
contract Escrow is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RELAY_ROLE = keccak256("RELAY_ROLE");

    eRWF public token;
    uint256 public nextDealId;

    mapping(address => uint256) public nonces;

    bytes32 public immutable DOMAIN_SEPARATOR;

    uint256 public constant FUND_LOCK_WINDOW = 24 hours;
    uint256 public constant DISPUTE_WINDOW = 3 hours;

    enum Status {
        Created,
        FundsLocked,
        Shipped,
        Delivered,
        Disputed,
        Released,
        Cancelled,
        Resolved
    }

    struct Deal {
        address sender;
        address driver;
        address receiver;
        uint256 amount;
        Status status;
        uint256 createdAt;
        uint256 fundLockDeadline;
        uint256 payoutReadyTime;
        bool isDisputed;
        uint8 disputeReasonCode;
    }

    mapping(uint256 => Deal) public deals;

    event DealCreated(
        uint256 indexed dealId,
        address indexed sender,
        address indexed driver,
        address receiver,
        uint256 amount,
        uint256 createdAt
    );
    event FundsLocked(
        uint256 indexed dealId,
        address indexed receiver,
        uint256 amount,
        uint256 timestamp
    );
    event DealAutoCancelled(uint256 indexed dealId, uint256 timestamp);
    event DealCancelled(uint256 indexed dealId, uint256 timestamp);
    event MarkedShipped(uint256 indexed dealId, address indexed sender, uint256 timestamp);
    event MarkedDelivered(
        uint256 indexed dealId,
        address indexed driver,
        uint256 timestamp,
        uint256 payoutReadyTime
    );
    event DealRevoked(
        uint256 indexed dealId,
        address indexed revokedBy,
        uint8 reasonCode,
        uint256 timestamp
    );
    event FundsReleased(
        uint256 indexed dealId,
        address indexed sender,
        uint256 amount,
        uint256 timestamp
    );
    event DisputeResolved(
        uint256 indexed dealId,
        address indexed admin,
        uint256 amountToSender,
        uint256 amountToReceiver,
        uint256 timestamp
    );

    /**
     * @param _token eRWF address
     * @param admin ADMIN_ROLE + DEFAULT_ADMIN_ROLE
     * @param relay RELAY_ROLE — only account that may submit party meta-txs
     */
    constructor(address _token, address admin, address relay) {
        require(_token != address(0), "Invalid token address");
        require(admin != address(0), "Invalid admin address");
        require(relay != address(0), "Invalid relay address");

        token = eRWF(_token);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(RELAY_ROLE, relay);

        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256(bytes("EscrowContract")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Verify EIP-712 Action signature for `account` and consume their nonce.
     * @dev Called by every party-facing function. msg.sender is the relay; `account` is the logical caller.
     */
    function _verifySigner(
        address account,
        string memory functionName,
        uint256 dealId,
        bytes calldata signature
    ) internal returns (address signer) {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Action(string functionName,uint256 dealId,uint256 nonce)"),
                keccak256(bytes(functionName)),
                dealId,
                nonces[account]
            )
        );

        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        signer = digest.recover(signature);
        require(signer != address(0), "Invalid signature");
        require(signer == account, "Invalid signature");

        nonces[account]++;
        return signer;
    }

    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function createDeal(
        address sender,
        address driver,
        address receiver,
        uint256 amount,
        bytes calldata signature
    ) external onlyRole(RELAY_ROLE) returns (uint256) {
        require(sender != address(0), "Invalid sender address");
        _verifySigner(sender, "createDeal", nextDealId, signature);

        require(driver != address(0), "Invalid driver address");
        require(receiver != address(0), "Invalid receiver address");
        require(amount > 0, "Amount must be positive");
        require(sender != driver, "Sender cannot be driver");
        require(sender != receiver, "Sender cannot be receiver");
        require(driver != receiver, "Driver cannot be receiver");

        uint256 dealId = nextDealId++;

        deals[dealId] = Deal({
            sender: sender,
            driver: driver,
            receiver: receiver,
            amount: amount,
            status: Status.Created,
            createdAt: block.timestamp,
            fundLockDeadline: block.timestamp + FUND_LOCK_WINDOW,
            payoutReadyTime: 0,
            isDisputed: false,
            disputeReasonCode: 0
        });

        emit DealCreated(dealId, sender, driver, receiver, amount, block.timestamp);
        return dealId;
    }

    /**
     * @notice Lock receiver funds. Signature proves receiver intent; Escrow pulls via ESCROW_ROLE.
     */
    function lockFunds(uint256 dealId, bytes calldata signature)
        external
        onlyRole(RELAY_ROLE)
        nonReentrant
    {
        Deal storage deal = deals[dealId];
        address receiver = _verifySigner(deal.receiver, "lockFunds", dealId, signature);

        require(deal.status == Status.Created, "Deal not in Created status");
        require(block.timestamp <= deal.fundLockDeadline, "Fund lock deadline passed");

        token.pullFrom(receiver, deal.amount);

        deal.status = Status.FundsLocked;
        emit FundsLocked(dealId, receiver, deal.amount, block.timestamp);
    }

    function autoCancelIfUnlocked(uint256 dealId) external {
        Deal storage deal = deals[dealId];

        require(deal.status == Status.Created, "Deal not in Created status");
        require(block.timestamp > deal.fundLockDeadline, "Deadline not passed yet");

        deal.status = Status.Cancelled;
        emit DealAutoCancelled(dealId, block.timestamp);
    }

    function cancelBeforeLock(uint256 dealId, address caller, bytes calldata signature)
        external
        onlyRole(RELAY_ROLE)
    {
        _verifySigner(caller, "cancelBeforeLock", dealId, signature);
        Deal storage deal = deals[dealId];

        require(
            caller == deal.sender || caller == deal.receiver,
            "Only sender or receiver can cancel"
        );
        require(deal.status == Status.Created, "Deal not in Created status");

        deal.status = Status.Cancelled;
        emit DealCancelled(dealId, block.timestamp);
    }

    function markShipped(uint256 dealId, bytes calldata signature)
        external
        onlyRole(RELAY_ROLE)
    {
        Deal storage deal = deals[dealId];
        address sender = _verifySigner(deal.sender, "markShipped", dealId, signature);

        require(deal.status == Status.FundsLocked, "Funds must be locked first");

        deal.status = Status.Shipped;
        emit MarkedShipped(dealId, sender, block.timestamp);
    }

    function markDelivered(uint256 dealId, bytes calldata signature)
        external
        onlyRole(RELAY_ROLE)
    {
        Deal storage deal = deals[dealId];
        address driver = _verifySigner(deal.driver, "markDelivered", dealId, signature);

        require(deal.status == Status.Shipped, "Goods must be shipped first");

        deal.payoutReadyTime = block.timestamp + DISPUTE_WINDOW;
        deal.status = Status.Delivered;

        emit MarkedDelivered(dealId, driver, block.timestamp, deal.payoutReadyTime);
    }

    function revoke(uint256 dealId, uint8 reasonCode, address caller, bytes calldata signature)
        external
        onlyRole(RELAY_ROLE)
    {
        _verifySigner(caller, "revoke", dealId, signature);
        Deal storage deal = deals[dealId];

        require(
            caller == deal.sender || caller == deal.receiver,
            "Only sender or receiver can revoke"
        );
        require(
            deal.status == Status.FundsLocked ||
                deal.status == Status.Shipped ||
                deal.status == Status.Delivered,
            "Invalid status for revoke"
        );

        deal.status = Status.Disputed;
        deal.isDisputed = true;
        deal.disputeReasonCode = reasonCode;

        emit DealRevoked(dealId, caller, reasonCode, block.timestamp);
    }

    function releaseFunds(uint256 dealId) external nonReentrant {
        Deal storage deal = deals[dealId];

        require(deal.status == Status.Delivered, "Deal not in Delivered status");
        require(block.timestamp >= deal.payoutReadyTime, "Dispute window not expired");

        deal.status = Status.Released;

        require(token.transfer(deal.sender, deal.amount), "Token transfer failed");

        emit FundsReleased(dealId, deal.sender, deal.amount, block.timestamp);
    }

    function resolveDispute(
        uint256 dealId,
        uint256 amountToSender,
        uint256 amountToReceiver
    ) external onlyRole(ADMIN_ROLE) nonReentrant {
        Deal storage deal = deals[dealId];

        require(deal.status == Status.Disputed, "Deal not in Disputed status");
        require(
            amountToSender + amountToReceiver == deal.amount,
            "Amounts must sum to deal amount"
        );

        deal.status = Status.Resolved;

        if (amountToSender > 0) {
            require(token.transfer(deal.sender, amountToSender), "Transfer to sender failed");
        }
        if (amountToReceiver > 0) {
            require(
                token.transfer(deal.receiver, amountToReceiver),
                "Transfer to receiver failed"
            );
        }

        emit DisputeResolved(
            dealId,
            msg.sender,
            amountToSender,
            amountToReceiver,
            block.timestamp
        );
    }

    function getDeal(uint256 dealId) external view returns (Deal memory) {
        return deals[dealId];
    }
}
