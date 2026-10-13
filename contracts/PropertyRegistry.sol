// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from '@openzeppelin/contracts/access/AccessControl.sol';

contract PropertyRegistry is AccessControl {
    bytes32 public constant VERIFIER_ROLE = keccak256('VERIFIER_ROLE');

    struct Property {
        address owner;
        bytes32 metadataHash;
        bytes32 ownershipProofHash;
        uint64 createdAt;
        bool verified;
        bool active;
    }

    uint256 public nextPropertyId = 1;
    mapping(uint256 => Property) public properties;

    event PropertyRegistered(uint256 indexed propertyId, address indexed owner, bytes32 metadataHash);
    event PropertyVerified(uint256 indexed propertyId, address indexed verifier);
    event PropertyStatusChanged(uint256 indexed propertyId, bool active);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    function register(bytes32 metadataHash, bytes32 ownershipProofHash) external returns (uint256 propertyId) {
        require(metadataHash != bytes32(0) && ownershipProofHash != bytes32(0), 'Missing proof');
        propertyId = nextPropertyId++;
        properties[propertyId] = Property(msg.sender, metadataHash, ownershipProofHash, uint64(block.timestamp), false, true);
        emit PropertyRegistered(propertyId, msg.sender, metadataHash);
    }

    function verify(uint256 propertyId) external onlyRole(VERIFIER_ROLE) {
        Property storage property = properties[propertyId];
        require(property.owner != address(0), 'Unknown property');
        property.verified = true;
        emit PropertyVerified(propertyId, msg.sender);
    }

    function setActive(uint256 propertyId, bool active) external {
        Property storage property = properties[propertyId];
        require(msg.sender == property.owner || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), 'Not authorized');
        property.active = active;
        emit PropertyStatusChanged(propertyId, active);
    }

    function isVerifiedOwner(uint256 propertyId, address account) external view returns (bool) {
        Property memory property = properties[propertyId];
        return property.owner == account && property.verified && property.active;
    }
}
