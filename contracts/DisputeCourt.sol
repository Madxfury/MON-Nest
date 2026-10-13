// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

interface IRentalEscrowCourt {
    function resolve(uint256 agreementId, uint256 ownerAmount, uint256 renterAmount) external;
    function disputeInfo(uint256 agreementId) external view returns (bool disputed, address owner, address renter, uint256 rentHeld, uint256 deposit);
}

interface IReputation {
    function record(address account, uint8 role, bool positive, bytes32 reason) external;
}

contract DisputeCourt is ReentrancyGuard, AccessControl {
    uint256 public constant MIN_STAKE = 1 ether;
    uint256 public constant MAX_JURY = 11;
    uint8 private constant ROLE_RENTER = 0;
    uint8 private constant ROLE_OWNER = 1;
    uint8 private constant ROLE_JUROR = 2;
    enum Outcome { Pending, OwnerWins, RenterWins, Split }

    IRentalEscrowCourt public immutable escrow;
    IReputation public reputation;
    uint64 public commitWindow = 2 days;
    uint64 public revealWindow = 1 days;
    mapping(address => uint256) public stake;
    mapping(address => uint256) public lockedStake;

    struct Case {
        uint256 agreementId; uint64 commitDeadline; uint64 revealDeadline;
        uint16 ownerVotes; uint16 renterVotes; Outcome outcome;
    }
    uint256 public nextCaseId = 1;
    mapping(uint256 => Case) public cases;
    mapping(uint256 => uint256) public caseOfAgreement;
    mapping(uint256 => address[]) public jurors;
    mapping(uint256 => mapping(address => bytes32)) public commitments;
    mapping(uint256 => mapping(address => bool)) public revealed;
    mapping(uint256 => mapping(address => bool)) public votedOwner;

    event JurorStaked(address indexed juror, uint256 amount);
    event StakeWithdrawn(address indexed juror, uint256 amount);
    event WindowsChanged(uint64 commitWindow, uint64 revealWindow);
    event CaseCreated(uint256 indexed caseId, uint256 indexed agreementId, address[] jurors);
    event VoteCommitted(uint256 indexed caseId, address indexed juror);
    event VoteRevealed(uint256 indexed caseId, address indexed juror, bool ownerWins);
    event JurorSlashed(uint256 indexed caseId, address indexed juror, uint256 amount);
    event JurorRewarded(uint256 indexed caseId, address indexed juror, uint256 amount);
    event CaseFinalized(uint256 indexed caseId, bool ownerWins);
    event CaseOutcome(uint256 indexed caseId, Outcome outcome, uint256 ownerAmount, uint256 renterAmount);

    constructor(address admin, address escrowAddress) {
        escrow = IRentalEscrowCourt(escrowAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function setReputation(address reputationAddress) external onlyRole(DEFAULT_ADMIN_ROLE) {
        reputation = IReputation(reputationAddress);
    }

    /// @notice Shorter windows make a live demo possible; production should keep days.
    function setWindows(uint64 commitSeconds, uint64 revealSeconds) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(commitSeconds >= 60 && revealSeconds >= 60, 'Window too short');
        commitWindow = commitSeconds;
        revealWindow = revealSeconds;
        emit WindowsChanged(commitSeconds, revealSeconds);
    }

    function depositStake() external payable {
        require(msg.value > 0, 'Zero stake');
        stake[msg.sender] += msg.value;
        emit JurorStaked(msg.sender, msg.value);
    }

    function withdrawStake(uint256 amount) external nonReentrant {
        require(stake[msg.sender] - lockedStake[msg.sender] >= amount, 'Stake locked');
        stake[msg.sender] -= amount;
        (bool ok,) = payable(msg.sender).call{value: amount}('');
        require(ok, 'Transfer failed');
        emit StakeWithdrawn(msg.sender, amount);
    }

    function createCase(uint256 agreementId, address[] calldata selectedJurors) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 caseId) {
        require(selectedJurors.length >= 3 && selectedJurors.length % 2 == 1, 'Odd jury required');
        require(selectedJurors.length <= MAX_JURY, 'Jury too large');
        (bool disputed, address owner, address renter,,) = escrow.disputeInfo(agreementId);
        require(disputed, 'Agreement not disputed');
        require(caseOfAgreement[agreementId] == 0, 'Case exists');
        caseId = nextCaseId++;
        caseOfAgreement[agreementId] = caseId;
        cases[caseId] = Case(agreementId, uint64(block.timestamp + commitWindow), uint64(block.timestamp + commitWindow + revealWindow), 0, 0, Outcome.Pending);
        for (uint256 i; i < selectedJurors.length; i++) {
            address juror = selectedJurors[i];
            require(juror != owner && juror != renter, 'Party cannot judge');
            require(stake[juror] - lockedStake[juror] >= MIN_STAKE, 'Juror under-staked');
            for (uint256 j; j < i; j++) require(selectedJurors[j] != juror, 'Duplicate juror');
            lockedStake[juror] += MIN_STAKE;
            jurors[caseId].push(juror);
        }
        emit CaseCreated(caseId, agreementId, selectedJurors);
    }

    function commitVote(uint256 caseId, bytes32 commitment) external {
        Case memory dispute = cases[caseId];
        require(block.timestamp < dispute.commitDeadline && _isJuror(caseId, msg.sender), 'Cannot commit');
        require(commitment != bytes32(0) && commitments[caseId][msg.sender] == bytes32(0), 'Invalid commitment');
        commitments[caseId][msg.sender] = commitment;
        emit VoteCommitted(caseId, msg.sender);
    }

    function revealVote(uint256 caseId, bool ownerWins, bytes32 salt) external {
        Case storage dispute = cases[caseId];
        require(block.timestamp >= dispute.commitDeadline && block.timestamp < dispute.revealDeadline, 'Not reveal window');
        require(!revealed[caseId][msg.sender], 'Already revealed');
        require(commitments[caseId][msg.sender] == keccak256(abi.encode(caseId, msg.sender, ownerWins, salt)), 'Bad reveal');
        revealed[caseId][msg.sender] = true;
        votedOwner[caseId][msg.sender] = ownerWins;
        if (ownerWins) dispute.ownerVotes++; else dispute.renterVotes++;
        emit VoteRevealed(caseId, msg.sender, ownerWins);
    }

    /// @notice Settles the case. A majority takes all held funds. If votes tie (only possible
    /// when jurors fail to reveal), the owner keeps unreleased rent and the renter gets the
    /// deposit back. Jurors who never revealed lose their locked stake to the majority.
    function finalize(uint256 caseId) external nonReentrant {
        Case storage dispute = cases[caseId];
        require(dispute.revealDeadline != 0 && dispute.outcome == Outcome.Pending && block.timestamp >= dispute.revealDeadline, 'Cannot finalize');
        (, address owner, address renter, uint256 rentHeld, uint256 deposit) = escrow.disputeInfo(dispute.agreementId);
        Outcome outcome = dispute.ownerVotes > dispute.renterVotes ? Outcome.OwnerWins
            : dispute.renterVotes > dispute.ownerVotes ? Outcome.RenterWins : Outcome.Split;
        dispute.outcome = outcome;

        _settleJurors(caseId, outcome);

        uint256 total = rentHeld + deposit;
        uint256 ownerAmount = outcome == Outcome.OwnerWins ? total : outcome == Outcome.RenterWins ? 0 : rentHeld;
        escrow.resolve(dispute.agreementId, ownerAmount, total - ownerAmount);

        if (address(reputation) != address(0) && outcome != Outcome.Split) {
            reputation.record(owner, ROLE_OWNER, outcome == Outcome.OwnerWins, bytes32(caseId));
            reputation.record(renter, ROLE_RENTER, outcome == Outcome.RenterWins, bytes32(caseId));
        }
        emit CaseFinalized(caseId, outcome == Outcome.OwnerWins);
        emit CaseOutcome(caseId, outcome, ownerAmount, total - ownerAmount);
    }

    function jurorsOf(uint256 caseId) external view returns (address[] memory) {
        return jurors[caseId];
    }

    function _settleJurors(uint256 caseId, Outcome outcome) private {
        address[] memory selectedJurors = jurors[caseId];
        uint256 slashed;
        uint256 winners;
        for (uint256 i; i < selectedJurors.length; i++) {
            address juror = selectedJurors[i];
            lockedStake[juror] -= MIN_STAKE;
            if (!revealed[caseId][juror]) {
                stake[juror] -= MIN_STAKE;
                slashed += MIN_STAKE;
                emit JurorSlashed(caseId, juror, MIN_STAKE);
                _recordJuror(juror, false, caseId);
            } else if (_inMajority(caseId, juror, outcome)) {
                winners++;
            }
        }
        if (slashed == 0 || winners == 0) return;
        uint256 share = slashed / winners;
        for (uint256 i; i < selectedJurors.length; i++) {
            address juror = selectedJurors[i];
            if (revealed[caseId][juror] && _inMajority(caseId, juror, outcome)) {
                stake[juror] += share;
                emit JurorRewarded(caseId, juror, share);
                _recordJuror(juror, true, caseId);
            }
        }
    }

    function _inMajority(uint256 caseId, address juror, Outcome outcome) private view returns (bool) {
        if (outcome == Outcome.Split) return true;
        return votedOwner[caseId][juror] == (outcome == Outcome.OwnerWins);
    }

    function _recordJuror(address juror, bool positive, uint256 caseId) private {
        if (address(reputation) != address(0)) reputation.record(juror, ROLE_JUROR, positive, bytes32(caseId));
    }

    function _isJuror(uint256 caseId, address account) internal view returns (bool) {
        address[] memory selectedJurors = jurors[caseId];
        for (uint256 i; i < selectedJurors.length; i++) if (selectedJurors[i] == account) return true;
        return false;
    }
}
