const axios = require("axios");
const cron = require("node-cron");
const dotenv = require("dotenv");
const {
  Args,
  CHAIN_ID,
  WalletClient,
  ClientFactory,
  DefaultProviderUrls,
  MAX_GAS_CALL,
  fromMAS,
} = require("@massalabs/massa-web3");

// Load .env file content into process.env
dotenv.config();

// Get environment variables
const privateKey = process.env["WALLET_SECRET_KEY"];
const priceContractAddress = process.env["MAINNET_PRICE_CONTRACT"];

const config = {
  COINGECKO_API_URL: "https://api.coingecko.com/api/v3",
};

let Client;

// Initialize Massa Web3 client
async function initClient() {
  const baseAccount = await WalletClient.getAccountFromSecretKey(privateKey);
  const chainId = CHAIN_ID.BuildNet;

  Client = await ClientFactory.createDefaultClient(
    DefaultProviderUrls.BUILDNET,
    chainId,
    true, // retry failed requests
    baseAccount // optional parameter
  );
}

async function fetchTokenPrice(coinId) {
  try {
    console.log(`Fetching price for token: ${coinId}...`);
    const response = await axios.get(
      `${config.COINGECKO_API_URL}/coins/${coinId}`
    );
    const price = response.data.market_data.current_price.usd;
    console.log(`Fetched price for token ${coinId}: $${price}`);
    const tx = await Client.smartContracts().callSmartContract({
      targetAddress: priceContractAddress,
      targetFunction: "updatePrice",
      parameter: new Args()
        .addString(coinId.toUpperCase())
        .addF64(parseFloat(price)),
      maxGas: BigInt(MAX_GAS_CALL),
      coins: fromMAS(0),
      fee: fromMAS(0.01),
    });
    console.log(tx);
    return price;
  } catch (error) {
    console.error(`Failed to fetch price for token ${coinId}:`, error.message);
    throw error;
  }
}

// Function to fetch prices for multiple tokens
async function fetchPrices() {
  await initClient();
  await fetchTokenPrice("bitcoin");
  await fetchTokenPrice("ethereum");
  await fetchTokenPrice("massa");
  await fetchTokenPrice("solana");
}

// Run immediately when the script starts
(async () => {
  console.log("Executing immediately...");
  await initClient();
  await fetchPrices();
})();

// Schedule the cron job to run every 5 minutes
cron.schedule("*/20 * * * *", async () => {
  console.log("Executing scheduled task...");
  await fetchPrices();
});
