// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuard} from '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

interface IRentalEscrowCourt {
    function resolve(uint256 agreementId, uint256 ownerAmount, uint256 renterAmount) external;
}

contract DisputeCourt is ReentrancyGuard, AccessControl {
    uint256 public constant MIN_STAKE = 1 ether;
    uint64 public constant COMMIT_WINDOW = 2 days;
    uint64 public constant REVEAL_WINDOW = 1 days;
    IRentalEscrowCourt public immutable escrow;
    mapping(address => uint256) public stake;
    mapping(address => uint256) public lockedStake;

    struct Case {
        uint256 agreementId; uint128 escrowValue; uint64 commitDeadline; uint64 revealDeadline;
        uint16 ownerVotes; uint16 renterVotes; bool finalized;
    }
    uint256 public nextCaseId = 1;
    mapping(uint256 => Case) public cases;
    mapping(uint256 => address[]) public jurors;
    mapping(uint256 => mapping(address => bytes32)) public commitments;
    mapping(uint256 => mapping(address => bool)) public revealed;

    event JurorStaked(address indexed juror, uint256 amount);
    event CaseCreated(uint256 indexed caseId, uint256 indexed agreementId, address[] jurors);
    event VoteCommitted(uint256 indexed caseId, address indexed juror);
    event VoteRevealed(uint256 indexed caseId, address indexed juror, bool ownerWins);
    event CaseFinalized(uint256 indexed caseId, bool ownerWins);

    constructor(address admin, address escrowAddress) {
        escrow = IRentalEscrowCourt(escrowAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
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
    }

    function createCase(uint256 agreementId, uint128 escrowValue, address[] calldata selectedJurors) external onlyRole(DEFAULT_ADMIN_ROLE) returns (uint256 caseId) {
        require(selectedJurors.length >= 3 && selectedJurors.length % 2 == 1, 'Odd jury required');
        caseId = nextCaseId++;
        cases[caseId] = Case(agreementId, escrowValue, uint64(block.timestamp + COMMIT_WINDOW), uint64(block.timestamp + COMMIT_WINDOW + REVEAL_WINDOW), 0, 0, false);
        for (uint256 i; i < selectedJurors.length; i++) {
            address juror = selectedJurors[i];
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
        if (ownerWins) dispute.ownerVotes++; else dispute.renterVotes++;
        emit VoteRevealed(caseId, msg.sender, ownerWins);
    }

    function finalize(uint256 caseId) external {
        Case storage dispute = cases[caseId];
        require(!dispute.finalized && block.timestamp >= dispute.revealDeadline, 'Cannot finalize');
        dispute.finalized = true;
        bool ownerWins = dispute.ownerVotes > dispute.renterVotes;
        address[] memory selectedJurors = jurors[caseId];
        for (uint256 i; i < selectedJurors.length; i++) lockedStake[selectedJurors[i]] -= MIN_STAKE;
        escrow.resolve(dispute.agreementId, ownerWins ? dispute.escrowValue : 0, ownerWins ? 0 : dispute.escrowValue);
        emit CaseFinalized(caseId, ownerWins);
    }

    function _isJuror(uint256 caseId, address account) internal view returns (bool) {
        address[] memory selectedJurors = jurors[caseId];
        for (uint256 i; i < selectedJurors.length; i++) if (selectedJurors[i] == account) return true;
        return false;
    }
}
