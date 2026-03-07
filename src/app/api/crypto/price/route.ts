import { NextRequest, NextResponse } from "next/server";

// Common crypto tickers to CoinGecko IDs mapping
const TICKER_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  MATIC: "matic-network",
  DOGE: "dogecoin",
  ADA: "cardano",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  UNI: "uniswap",
  ATOM: "cosmos",
  XRP: "ripple",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  SHIB: "shiba-inu",
  USDT: "tether",
  USDC: "usd-coin",
  BNB: "binancecoin",
  TRX: "tron",
  TON: "the-open-network",
  XLM: "stellar",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  FIL: "filecoin",
  AAVE: "aave",
  MKR: "maker",
  CRV: "curve-dao-token",
  LDO: "lido-dao",
  PEPE: "pepe",
  FTM: "fantom",
  ALGO: "algorand",
  VET: "vechain",
  HBAR: "hedera-hashgraph",
  ICP: "internet-computer",
  GRT: "the-graph",
  SAND: "the-sandbox",
  MANA: "decentraland",
  AXS: "axie-infinity",
  APE: "apecoin",
  COMP: "compound-governance-token",
  SNX: "synthetix-network-token",
  SUSHI: "sushi",
  YFI: "yearn-finance",
  "1INCH": "1inch",
  ENJ: "enjincoin",
  BAT: "basic-attention-token",
  ZRX: "0x",
  ANKR: "ankr",
  IMX: "immutable-x",
  RNDR: "render-token",
  INJ: "injective-protocol",
  SUI: "sui",
  SEI: "sei-network",
  TIA: "celestia",
  JUP: "jupiter-exchange-solana",
  WIF: "dogwifcoin",
  BONK: "bonk",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker")?.toUpperCase();

    if (!ticker) {
      return NextResponse.json(
        { error: "Ticker is required" },
        { status: 400 }
      );
    }

    // Get CoinGecko ID from ticker
    const coingeckoId = TICKER_TO_COINGECKO[ticker];

    if (!coingeckoId) {
      // Try searching CoinGecko API for the ticker
      try {
        const searchResponse = await fetch(
          `https://api.coingecko.com/api/v3/search?query=${ticker}`
        );

        if (searchResponse.ok) {
          const searchData = await searchResponse.json();
          const coin = searchData.coins?.find(
            (c: { symbol: string }) => c.symbol.toUpperCase() === ticker
          );

          if (coin) {
            // Fetch price for the found coin
            const priceResponse = await fetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${coin.id}&vs_currencies=usd`
            );

            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              const price = priceData[coin.id]?.usd;

              if (price !== undefined) {
                return NextResponse.json({
                  ticker,
                  name: coin.name,
                  price,
                });
              }
            }
          }
        }
      } catch {
        // Fallback error handling below
      }

      return NextResponse.json(
        { error: `Could not find price for ticker: ${ticker}` },
        { status: 404 }
      );
    }

    // Fetch price from CoinGecko
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch crypto price" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const price = data[coingeckoId]?.usd;

    if (price === undefined) {
      return NextResponse.json(
        { error: `Could not find price for ticker: ${ticker}` },
        { status: 404 }
      );
    }

    // Get coin name from the mapping
    const coinNames: Record<string, string> = {
      BTC: "Bitcoin",
      ETH: "Ethereum",
      SOL: "Solana",
      MATIC: "Polygon",
      DOGE: "Dogecoin",
      ADA: "Cardano",
      DOT: "Polkadot",
      AVAX: "Avalanche",
      LINK: "Chainlink",
      UNI: "Uniswap",
      ATOM: "Cosmos",
      XRP: "XRP",
      LTC: "Litecoin",
      BCH: "Bitcoin Cash",
      SHIB: "Shiba Inu",
      USDT: "Tether",
      USDC: "USD Coin",
      BNB: "BNB",
      TRX: "TRON",
      TON: "Toncoin",
      XLM: "Stellar",
      NEAR: "NEAR Protocol",
      APT: "Aptos",
      ARB: "Arbitrum",
      OP: "Optimism",
      FIL: "Filecoin",
      AAVE: "Aave",
      MKR: "Maker",
      CRV: "Curve DAO",
      LDO: "Lido DAO",
      PEPE: "Pepe",
      FTM: "Fantom",
      ALGO: "Algorand",
      VET: "VeChain",
      HBAR: "Hedera",
      ICP: "Internet Computer",
      GRT: "The Graph",
      SAND: "The Sandbox",
      MANA: "Decentraland",
      AXS: "Axie Infinity",
      APE: "ApeCoin",
      COMP: "Compound",
      SNX: "Synthetix",
      SUSHI: "SushiSwap",
      YFI: "yearn.finance",
      "1INCH": "1inch",
      ENJ: "Enjin Coin",
      BAT: "Basic Attention Token",
      ZRX: "0x",
      ANKR: "Ankr",
      IMX: "Immutable",
      RNDR: "Render",
      INJ: "Injective",
      SUI: "Sui",
      SEI: "Sei",
      TIA: "Celestia",
      JUP: "Jupiter",
      WIF: "dogwifhat",
      BONK: "Bonk",
    };

    return NextResponse.json({
      ticker,
      name: coinNames[ticker] || ticker,
      price,
    });
  } catch (error) {
    console.error("Failed to fetch crypto price:", error);
    return NextResponse.json(
      { error: "Failed to fetch crypto price" },
      { status: 500 }
    );
  }
}
