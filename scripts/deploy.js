const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const configuredBroker = process.env.BROKER_ADDRESS;
  if (!configuredBroker || !ethers.isAddress(configuredBroker)) {
    throw new Error('Set BROKER_ADDRESS to the broker wallet before deploying.');
  }
  const broker = ethers.getAddress(configuredBroker);
  console.log('Deploying MON-Nest contracts with:', deployer.address);
  console.log('Broker payment recipient:', broker);

  const registry = await ethers.deployContract('PropertyRegistry', [deployer.address]);
  await registry.waitForDeployment();
  const reputation = await ethers.deployContract('Reputation', [deployer.address]);
  await reputation.waitForDeployment();
  const escrow = await ethers.deployContract('RentalEscrow', [deployer.address, await registry.getAddress()]);
  await escrow.waitForDeployment();
  const court = await ethers.deployContract('DisputeCourt', [deployer.address, await escrow.getAddress()]);
  await court.waitForDeployment();
  const bookings = await ethers.deployContract('MonNestBookings', [deployer.address, broker]);
  await bookings.waitForDeployment();

  await (await escrow.grantRole(await escrow.COURT_ROLE(), await court.getAddress())).wait();
  await (await reputation.grantRole(await reputation.UPDATER_ROLE(), await court.getAddress())).wait();

  console.log(JSON.stringify({
    PropertyRegistry: await registry.getAddress(),
    Reputation: await reputation.getAddress(),
    RentalEscrow: await escrow.getAddress(),
    DisputeCourt: await court.getAddress(),
    MonNestBookings: await bookings.getAddress(),
    Broker: broker,
  }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
