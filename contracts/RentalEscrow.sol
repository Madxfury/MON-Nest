// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {Pausable} from '@openzeppelin/contracts/utils/Pausable.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

interface IPropertyRegistry {
    function isVerifiedOwner(uint256 propertyId, address account) external view returns (bool);
}

/// @notice Holds each agreement's rent and deposit separately. Funds only leave through
/// scheduled rent releases, completion, cancellation, or a court ruling, and are paid out
/// via pull payments (`withdraw`).
contract RentalEscrow is ReentrancyGuard, Pausable, AccessControl {
    bytes32 public constant COURT_ROLE = keccak256('COURT_ROLE');
    uint256 public constant RENT_PERIOD = 30 days;
    uint16 public constant MAX_FEE_BPS = 500;
    enum State { Created, Funded, Active, Disputed, Completed, Cancelled }
    struct Agreement {
        uint256 propertyId; address owner; address renter; uint128 monthlyRent; uint128 deposit;
        uint64 startAt; uint64 endAt; uint64 nextReleaseAt; State state; bytes32 termsHash;
    }
    IPropertyRegistry public immutable registry;
    uint256 public nextAgreementId = 1;
    uint16 public platformFeeBps;
    address public feeRecipient;
    mapping(uint256 => Agreement) public agreements;
    mapping(address => uint256) public claimable;
    // Per-agreement accounting prevents one tenancy spending another's deposit.
    // Holds this agreement's unreleased rent plus its deposit.
    mapping(uint256 => uint256) public remainingEscrow;

    event AgreementCreated(uint256 indexed agreementId, uint256 indexed propertyId, address indexed renter, address owner);
    event AgreementFunded(uint256 indexed agreementId, uint256 amount);
    event RentDeposited(uint256 indexed agreementId, uint256 amount);
    event RentReleased(uint256 indexed agreementId, uint256 amount);
    event DisputeOpened(uint256 indexed agreementId, bytes32 evidenceRoot);
    event AgreementResolved(uint256 indexed agreementId, uint256 ownerAmount, uint256 renterAmount);
    event AgreementCompleted(uint256 indexed agreementId, uint256 ownerAmount, uint256 renterAmount);
    event AgreementCancelled(uint256 indexed agreementId, uint256 refund);
    event PlatformFeeChanged(uint16 feeBps, address recipient);
    event Withdrawal(address indexed account, uint256 amount);

    constructor(address admin, address registryAddress) {
        registry = IPropertyRegistry(registryAddress);
        feeRecipient = admin;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setPlatformFee(uint16 feeBps, address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(feeBps <= MAX_FEE_BPS && recipient != address(0), 'Invalid fee');
        platformFeeBps = feeBps;
        feeRecipient = recipient;
        emit PlatformFeeChanged(feeBps, recipient);
    }

    function createAgreement(uint256 propertyId, address owner, uint128 monthlyRent, uint128 deposit, uint64 startAt, uint64 endAt, bytes32 termsHash) external whenNotPaused returns (uint256 id) {
        require(registry.isVerifiedOwner(propertyId, owner), 'Owner not verified');
        require(msg.sender != owner, 'Owner cannot rent');
        require(monthlyRent > 0 && endAt > startAt && termsHash != bytes32(0), 'Invalid terms');
        id = nextAgreementId++;
        agreements[id] = Agreement(propertyId, owner, msg.sender, monthlyRent, deposit, startAt, endAt, startAt, State.Created, termsHash);
        emit AgreementCreated(id, propertyId, msg.sender, owner);
    }

    /// @notice Renter funds the first month's rent plus the deposit.
    function fund(uint256 id) external payable whenNotPaused nonReentrant {
        require(msg.sender == agreements[id].renter, 'Not renter');
        _fund(id);
    }

    /// @notice Aurora's intermediary may fund an existing renter's agreement.
    /// Funds and refunds always belong to the agreement parties, never the caller.
    function fundFor(uint256 id) external payable whenNotPaused nonReentrant {
        _fund(id);
    }

    /// @notice Renter tops up escrow with a later month's rent.
    function payRent(uint256 id) external payable whenNotPaused nonReentrant {
        Agreement storage agreement = agreements[id];
        require(msg.sender == agreement.renter && _isLive(agreement.state), 'Cannot pay');
        require(msg.value == agreement.monthlyRent, 'Wrong value');
        remainingEscrow[id] += msg.value;
        emit RentDeposited(id, msg.value);
    }

    /// @notice Releases one month of funded rent to the owner once its period has started.
    function releaseRent(uint256 id) external whenNotPaused nonReentrant {
        Agreement storage agreement = agreements[id];
        require(_isLive(agreement.state), 'Not releasable');
        require(block.timestamp >= agreement.nextReleaseAt, 'Too early');
        require(rentHeld(id) >= agreement.monthlyRent, 'Rent already released');
        require(agreement.nextReleaseAt < agreement.endAt, 'Lease ended');
        agreement.state = State.Active;
        agreement.nextReleaseAt += uint64(RENT_PERIOD);
        remainingEscrow[id] -= agreement.monthlyRent;
        _payOwner(agreement.owner, agreement.monthlyRent);
        emit RentReleased(id, agreement.monthlyRent);
    }

    /// @notice Closes an undisputed agreement: unreleased rent goes to the owner and the
    /// deposit back to the renter. The renter may close after `endAt`; the owner may close
    /// at any time, which waives any claim on the deposit.
    function complete(uint256 id) external nonReentrant {
        Agreement storage agreement = agreements[id];
        require(_isLive(agreement.state), 'Not active');
        require(msg.sender == agreement.owner || (msg.sender == agreement.renter && block.timestamp >= agreement.endAt), 'Cannot complete');
        uint256 rent = rentHeld(id);
        remainingEscrow[id] = 0;
        agreement.state = State.Completed;
        if (rent > 0) _payOwner(agreement.owner, rent);
        claimable[agreement.renter] += agreement.deposit;
        emit AgreementCompleted(id, rent, agreement.deposit);
    }

    /// @notice Renter or owner cancels before the lease starts; any funds go back to the renter.
    function cancel(uint256 id) external nonReentrant {
        Agreement storage agreement = agreements[id];
        require(msg.sender == agreement.renter || msg.sender == agreement.owner, 'Not party');
        require(agreement.state == State.Created || (agreement.state == State.Funded && block.timestamp < agreement.startAt), 'Cannot cancel');
        uint256 refund = remainingEscrow[id];
        remainingEscrow[id] = 0;
        agreement.state = State.Cancelled;
        claimable[agreement.renter] += refund;
        emit AgreementCancelled(id, refund);
    }

    function openDispute(uint256 id, bytes32 evidenceRoot) external whenNotPaused {
        Agreement storage agreement = agreements[id];
        require(msg.sender == agreement.owner || msg.sender == agreement.renter, 'Not party');
        require(_isLive(agreement.state), 'Bad state');
        require(evidenceRoot != bytes32(0), 'Missing evidence');
        agreement.state = State.Disputed;
        emit DisputeOpened(id, evidenceRoot);
    }

    /// @notice Court ruling. The split must account for exactly this agreement's held funds.
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

    /// @notice Funded rent for this agreement that has not been released to the owner yet.
    function rentHeld(uint256 id) public view returns (uint256) {
        uint256 held = remainingEscrow[id];
        uint256 deposit = agreements[id].deposit;
        return held > deposit ? held - deposit : 0;
    }

    /// @notice True when no funded rent is waiting for release (read by the CRE workflow).
    function rentReleased(uint256 id) external view returns (bool) {
        return rentHeld(id) < agreements[id].monthlyRent;
    }

    function disputeInfo(uint256 id) external view returns (bool disputed, address owner, address renter, uint256 unreleasedRent, uint256 deposit) {
        Agreement storage agreement = agreements[id];
        return (agreement.state == State.Disputed, agreement.owner, agreement.renter, rentHeld(id), agreement.deposit);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function _fund(uint256 id) private {
        Agreement storage agreement = agreements[id];
        require(agreement.renter != address(0) && agreement.state == State.Created, 'Cannot fund');
        require(msg.value == uint256(agreement.monthlyRent) + agreement.deposit, 'Wrong value');
        remainingEscrow[id] = msg.value;
        agreement.state = block.timestamp >= agreement.startAt ? State.Active : State.Funded;
        emit AgreementFunded(id, msg.value);
    }

    function _isLive(State state) private pure returns (bool) {
        return state == State.Funded || state == State.Active;
    }

    function _payOwner(address owner, uint256 amount) private {
        uint256 fee = amount * platformFeeBps / 10_000;
        if (fee > 0) claimable[feeRecipient] += fee;
        claimable[owner] += amount - fee;
    }
}
