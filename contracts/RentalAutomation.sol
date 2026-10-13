// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {ERC165} from '@openzeppelin/contracts/utils/introspection/ERC165.sol';

interface IAutomationEscrow { function releaseRent(uint256 id) external; }
/// @notice Receives authenticated CRE reports. It cannot choose dispute awards.
contract RentalAutomation is Ownable, ERC165 {
    address public immutable forwarder;
    bytes32 public immutable workflowId;
    IAutomationEscrow public immutable escrow;
    mapping(bytes32 => bool) public processed;
    mapping(uint256 => uint64) public evidenceDeadlines;
    event DeadlineReached(uint256 indexed agreementId, uint64 deadline);
    event AutomatedRentRelease(uint256 indexed agreementId);
    constructor(address admin, address trustedForwarder, bytes32 trustedWorkflow, address escrowAddress) Ownable(admin) {
        require(trustedForwarder != address(0) && trustedWorkflow != bytes32(0) && escrowAddress != address(0), 'Missing configuration');
        forwarder = trustedForwarder; workflowId = trustedWorkflow; escrow = IAutomationEscrow(escrowAddress);
    }
    function setEvidenceDeadline(uint256 agreementId, uint64 deadline) external onlyOwner {
        require(deadline > block.timestamp && evidenceDeadlines[agreementId] == 0, 'Invalid deadline');
        evidenceDeadlines[agreementId] = deadline;
    }
    function onReport(bytes calldata metadata, bytes calldata report) external {
        require(msg.sender == forwarder, 'Untrusted forwarder');
        require(metadata.length >= 62 && bytes32(metadata[:32]) == workflowId, 'Untrusted workflow');
        (uint256 chainId, address receiver, uint64 scheduledAt, uint8 action, uint256 agreementId) = abi.decode(report, (uint256,address,uint64,uint8,uint256));
        require(chainId == block.chainid && receiver == address(this), 'Wrong report destination');
        require(scheduledAt <= block.timestamp && block.timestamp - scheduledAt <= 10 minutes, 'Stale report');
        bytes32 digest = keccak256(report); require(!processed[digest], 'Report replay'); processed[digest] = true;
        if (action == 0) { escrow.releaseRent(agreementId); emit AutomatedRentRelease(agreementId); }
        else if (action == 1) {
            uint64 deadline = evidenceDeadlines[agreementId];
            require(deadline != 0 && deadline <= block.timestamp, 'Deadline not reached');
            delete evidenceDeadlines[agreementId]; emit DeadlineReached(agreementId, deadline);
        } else revert('Unknown action');
    }
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == bytes4(keccak256('onReport(bytes,bytes)')) || super.supportsInterface(interfaceId);
    }
}
