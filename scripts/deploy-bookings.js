const { ethers, network } = require('hardhat');

async function main() {
  const configuredBroker = process.env.BROKER_ADDRESS;
  if (!configuredBroker || !ethers.isAddress(configuredBroker)) {
    throw new Error('Set BROKER_ADDRESS to the broker wallet before deploying.');
  }

  const [deployer] = await ethers.getSigners();
  const broker = ethers.getAddress(configuredBroker);
  const bookings = await ethers.deployContract('MonNestBookings', [deployer.address, broker]);
  await bookings.waitForDeployment();

  for (const listingId of [4, 45, 46, 47, 48]) {
    await (await bookings.setListing(listingId, 0, 30 * 24 * 60 * 60, true)).wait();
  }

  console.log(JSON.stringify({
    network: network.name,
    contract: await bookings.getAddress(),
    broker,
    zeroMonListingIds: [4, 45, 46, 47, 48],
  }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
