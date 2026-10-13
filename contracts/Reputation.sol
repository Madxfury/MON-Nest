// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

contract Reputation is AccessControl {
    bytes32 public constant UPDATER_ROLE = keccak256('UPDATER_ROLE');
    enum Role { Renter, Owner, Juror }
    struct Score { uint32 positive; uint32 negative; uint64 lastUpdated; }
    mapping(address => mapping(Role => Score)) public scores;
    event ReputationUpdated(address indexed account, Role indexed role, bool positive, bytes32 indexed reason);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
    }

    function record(address account, Role role, bool positive, bytes32 reason) external onlyRole(UPDATER_ROLE) {
        require(account != address(0), 'Zero account');
        Score storage score = scores[account][role];
        if (positive) score.positive++; else score.negative++;
        score.lastUpdated = uint64(block.timestamp);
        emit ReputationUpdated(account, role, positive, reason);
    }

    function percentage(address account, Role role) external view returns (uint256) {
        Score memory score = scores[account][role];
        uint256 total = uint256(score.positive) + score.negative;
        return total == 0 ? 0 : uint256(score.positive) * 100 / total;
    }
}
