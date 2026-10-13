// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {Pausable} from '@openzeppelin/contracts/utils/Pausable.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

interface IPropertyRegistry {
    function isVerifiedOwner(uint256 propertyId, address account) external view returns (bool);
}

contract RentalEscrow is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant COURT_ROLE = keccak256('COURT_ROLE');
    enum State { Created, Funded, Active, Disputed, Completed, Cancelled }
    struct Agreement {
        uint256 propertyId; address owner; address renter; uint128 monthlyRent; uint128 deposit;
        uint64 startAt; uint64 endAt; uint64 nextReleaseAt; State state; bytes32 termsHash;
    }
    IPropertyRegistry public immutable registry;
    uint256 public nextAgreementId = 1;
    mapping(uint256 => Agreement) public agreements;
    mapping(address => uint256) public claimable;
    // Per-agreement accounting prevents one tenancy spending another's deposit.
    mapping(uint256 => uint256) public remainingEscrow;
    mapping(uint256 => bool) public rentReleased;

    event AgreementCreated(uint256 indexed agreementId, uint256 indexed propertyId, address indexed renter, address owner);
    event AgreementFunded(uint256 indexed agreementId, uint256 amount);
    event RentReleased(uint256 indexed agreementId, uint256 amount);
    event DisputeOpened(uint256 indexed agreementId, bytes32 evidenceRoot);
    event AgreementResolved(uint256 indexed agreementId, uint256 ownerAmount, uint256 renterAmount);
    event Withdrawal(address indexed account, uint256 amount);

    constructor(address admin, address registryAddress) {
        registry = IPropertyRegistry(registryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function createAgreement(uint256 propertyId, address owner, uint128 monthlyRent, uint128 deposit, uint64 startAt, uint64 endAt, bytes32 termsHash) external whenNotPaused returns (uint256 id) {
        require(registry.isVerifiedOwner(propertyId, owner), 'Owner not verified');
        require(monthlyRent > 0 && endAt > startAt && termsHash != bytes32(0), 'Invalid terms');
        require(endAt - startAt <= 30 days, 'One funded month only');
        id = nextAgreementId++;
        agreements[id] = Agreement(propertyId, owner, msg.sender, monthlyRent, deposit, startAt, endAt, startAt, State.Created, termsHash);
        emit AgreementCreated(id, propertyId, msg.sender, owner);
    }

    function fund(uint256 id) external payable whenNotPaused nonReentrant {
        require(msg.sender == agreements[id].renter, 'Not renter');
        _fund(id);
    }

    /// @notice Aurora's intermediary may fund an existing renter's agreement.
    /// Funds and refunds always belong to the agreement parties, never the caller.
    function fundFor(uint256 id) external payable whenNotPaused nonReentrant {
        _fund(id);
    }

    function _fund(uint256 id) internal {
        Agreement storage agreement = agreements[id];
        require(agreement.renter != address(0) && agreement.state == State.Created, 'Cannot fund');
        require(msg.value == uint256(agreement.monthlyRent) + agreement.deposit, 'Wrong value');
        remainingEscrow[id] = msg.value;
        agreement.state = block.timestamp >= agreement.startAt ? State.Active : State.Funded;
        emit AgreementFunded(id, msg.value);
    }

    function releaseRent(uint256 id) external whenNotPaused nonReentrant {
        Agreement storage agreement = agreements[id];
        require(agreement.state == State.Funded || agreement.state == State.Active, 'Not releasable');
        require(block.timestamp >= agreement.nextReleaseAt, 'Too early');
        require(!rentReleased[id] && remainingEscrow[id] >= agreement.monthlyRent, 'Rent already released');
        rentReleased[id] = true;
        remainingEscrow[id] -= agreement.monthlyRent;
        agreement.state = State.Active;
        agreement.nextReleaseAt += 30 days;
        claimable[agreement.owner] += agreement.monthlyRent;
        emit RentReleased(id, agreement.monthlyRent);
    }

    function openDispute(uint256 id, bytes32 evidenceRoot) external whenNotPaused {
        Agreement storage agreement = agreements[id];
        require(msg.sender == agreement.owner || msg.sender == agreement.renter, 'Not party');
        require(agreement.state == State.Funded || agreement.state == State.Active, 'Bad state');
        require(evidenceRoot != bytes32(0), 'Missing evidence');
        agreement.state = State.Disputed;
        emit DisputeOpened(id, evidenceRoot);
    }

    function resolve(uint256 id, uint256 ownerAmount, uint256 renterAmount) external onlyRole(COURT_ROLE) nonReentrant {
        Agreement storage agreement = agreements[id];
        require(agreement.state == State.Disputed, 'Not disputed');
        require(ownerAmount + renterAmount == remainingEscrow[id], 'Wrong escrow allocation');
        remainingEscrow[id] = 0;
        agreement.state = State.Completed;
        claimable[agreement.owner] += ownerAmount;
        claimable[agreement.renter] += renterAmount;
        emit AgreementResolved(id, ownerAmount, renterAmount);
    }

    function withdraw() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        require(amount > 0, 'Nothing to withdraw');
        claimable[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}('');
        require(ok, 'Transfer failed');
        emit Withdrawal(msg.sender, amount);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
