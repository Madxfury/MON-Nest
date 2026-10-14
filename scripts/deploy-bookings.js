const { ethers, network } = require('hardhat');

async function main() {
  const configuredBroker = process.env.BROKER_ADDRESS;
  if (!configuredBroker || !ethers.isAddress(configuredBroker)) {
    throw new Error('Set BROKER_ADDRESS to the broker wallet before deploying.');
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error('Set DEPLOYER_PRIVATE_KEY to a funded Monad Testnet deployer wallet.');
  const broker = ethers.getAddress(configuredBroker);
  const bookings = await ethers.deployContract('MonNestBookings', [deployer.address, broker]);
  await bookings.waitForDeployment();
  const contractAddress = await bookings.getAddress();
  console.log(`MonNestBookings deployed on ${network.name} at ${contractAddress}`);

  console.log(JSON.stringify({
    network: network.name,
    contract: contractAddress,
    broker,
    zeroMonListingIds: Array.from({ length: 68 }, (_, index) => index + 1),
  }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
