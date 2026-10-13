const fs = require('fs');
const path = require('path');
const { ethers, network } = require('hardhat');

// Every paid catalog home (src/data.ts) rents through RentalEscrow; the twelve complimentary
// homes are free MonNestBookings listings instead.
const COMPLIMENTARY_HOME_IDS = [4, 27, 29, 31, 32, 36, 38, 42, 45, 46, 47, 48];
const ESCROW_HOME_IDS = Array.from({ length: 48 }, (_, index) => index + 1).filter(id => !COMPLIMENTARY_HOME_IDS.includes(id));

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
  await (await court.setReputation(await reputation.getAddress())).wait();
  await (await escrow.setPlatformFee(200, deployer.address)).wait();
  // Short jury windows so a dispute can be demonstrated live.
  await (await court.setWindows(5 * 60, 5 * 60)).wait();

  // The deployer acts as the verified demo owner of every escrow-enabled home (two batched transactions).
  const firstPropertyId = await registry.nextPropertyId();
  await (await registry.registerMany(ESCROW_HOME_IDS.map(id => ethers.id(`mon-nest-home-${id}`)), ESCROW_HOME_IDS.map(id => ethers.id(`mon-nest-demo-ownership-${id}`)))).wait();
  const propertyIds = ESCROW_HOME_IDS.map((_, index) => firstPropertyId + BigInt(index));
  await (await registry.verifyMany(propertyIds)).wait();
  const escrowProperties = Object.fromEntries(ESCROW_HOME_IDS.map((homeId, index) => [homeId, Number(propertyIds[index])]));

  const deployment = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    StartBlock: (await registry.deploymentTransaction().wait()).blockNumber,
    PropertyRegistry: await registry.getAddress(),
    Reputation: await reputation.getAddress(),
    RentalEscrow: await escrow.getAddress(),
    DisputeCourt: await court.getAddress(),
    MonNestBookings: await bookings.getAddress(),
    MonNestBookingsDeployBlock: (await bookings.deploymentTransaction().wait()).blockNumber,
    Broker: broker,
    escrowProperties,
  };
  if (network.name === 'monadTestnet') {
    fs.writeFileSync(path.join(__dirname, '..', 'src', 'deployments', 'monadTestnet.json'), `${JSON.stringify(deployment, null, 2)}\n`);
    console.log('Wrote src/deployments/monadTestnet.json');
  }
  console.log(JSON.stringify(deployment, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
