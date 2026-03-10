// Chain configuration for crypto balance fetching

export interface ChainConfig {
  name: string;
  symbol: string;
  decimals: number;
  apiUrl: string;
  priceApiId: string;
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  bitcoin: {
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 8,
    apiUrl: "https://blockstream.info/api",
    priceApiId: "bitcoin",
  },
  ethereum: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    apiUrl: "https://eth.llamarpc.com",
    priceApiId: "ethereum",
  },
  solana: {
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    apiUrl: "https://api.mainnet-beta.solana.com",
    priceApiId: "solana",
  },
  polygon: {
    name: "Polygon",
    symbol: "MATIC",
    decimals: 18,
    apiUrl: "https://api.polygonscan.com/api",
    priceApiId: "matic-network",
  },
};

// Fetch Bitcoin transaction data from Blockstream API
export async function fetchBitcoinTransaction(txid: string): Promise<{ balance: number; balanceUsd: number }> {
  const response = await fetch(
    `${CHAIN_CONFIGS.bitcoin.apiUrl}/tx/${txid}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Bitcoin transaction");
  }

  const data = await response.json();

  // Sum all outputs to get total transaction value
  const totalSatoshis = data.vout.reduce((sum: number, output: { value: number }) => sum + output.value, 0);
  const balance = totalSatoshis / 100000000; // Convert satoshis to BTC

  // Fetch current price
  const price = await fetchCryptoPrice(CHAIN_CONFIGS.bitcoin.priceApiId);
  const balanceUsd = balance * price;

  return { balance, balanceUsd };
}

// Fetch Ethereum transaction data from public RPC
export async function fetchEthereumTransaction(txid: string): Promise<{ balance: number; balanceUsd: number }> {
  // Use eth_getTransactionByHash to fetch transaction details
  const response = await fetch(CHAIN_CONFIGS.ethereum.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionByHash",
      params: [txid],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Ethereum transaction");
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "Invalid Ethereum transaction");
  }

  if (!data.result) {
    throw new Error("Transaction not found");
  }

  // Get the value from the transaction (in wei, hex-encoded)
  const valueWei = BigInt(data.result.value);
  const balance = Number(valueWei) / 1e18; // Convert wei to ETH

  // Fetch current price
  const price = await fetchCryptoPrice(CHAIN_CONFIGS.ethereum.priceApiId);
  const balanceUsd = balance * price;

  return { balance, balanceUsd };
}

// Fetch Bitcoin balance from Blockstream API
export async function fetchBitcoinBalance(address: string): Promise<number> {
  const response = await fetch(
    `${CHAIN_CONFIGS.bitcoin.apiUrl}/address/${address}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Bitcoin balance");
  }

  const data = await response.json();
  // Include both confirmed (chain_stats) and pending (mempool_stats) balances
  const confirmedSatoshis =
    data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
  const pendingSatoshis =
    data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
  const totalSatoshis = confirmedSatoshis + pendingSatoshis;
  return totalSatoshis / 100000000; // Convert satoshis to BTC
}

// Fetch Ethereum balance from public RPC
export async function fetchEthereumBalance(address: string): Promise<number> {
  const response = await fetch(CHAIN_CONFIGS.ethereum.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getBalance",
      params: [address, "latest"],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Ethereum balance");
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "Invalid Ethereum address");
  }

  // Result is hex-encoded wei
  const wei = BigInt(data.result);
  return Number(wei) / 1e18; // Convert wei to ETH
}

// Fetch Solana balance from RPC
export async function fetchSolanaBalance(address: string): Promise<number> {
  const response = await fetch(CHAIN_CONFIGS.solana.apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address],
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Solana balance");
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message || "Invalid Solana address");
  }

  const lamports = data.result.value;
  return lamports / 1e9; // Convert lamports to SOL
}

// Fetch crypto price from CoinGecko
export async function fetchCryptoPrice(
  priceApiId: string
): Promise<number> {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${priceApiId}&vs_currencies=usd`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch crypto price");
  }

  const data = await response.json();
  return data[priceApiId]?.usd ?? 0;
}

// Main function to fetch wallet balance and USD value
export async function fetchWalletData(
  chain: string,
  address: string
): Promise<{ balance: number; balanceUsd: number }> {
  const config = CHAIN_CONFIGS[chain];
  if (!config) {
    throw new Error(`Unsupported chain: ${chain}`);
  }

  let balance: number;

  switch (chain) {
    case "bitcoin":
      balance = await fetchBitcoinBalance(address);
      break;
    case "ethereum":
      balance = await fetchEthereumBalance(address);
      break;
    case "solana":
      balance = await fetchSolanaBalance(address);
      break;
    default:
      throw new Error(`Chain ${chain} not yet implemented`);
  }

  const price = await fetchCryptoPrice(config.priceApiId);
  const balanceUsd = balance * price;

  return { balance, balanceUsd };
}
