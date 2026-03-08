import { NextRequest, NextResponse } from "next/server";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  tickers: string[];
}

// Simple in-memory cache
const newsCache = new Map<string, { data: NewsItem[]; timestamp: number }>();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

// Map common crypto tickers to CoinGecko IDs for news
const TICKER_TO_COINGECKO: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  MATIC: "polygon",
  ADA: "cardano",
  DOT: "polkadot",
  DOGE: "dogecoin",
  SHIB: "shiba-inu",
  AVAX: "avalanche-2",
  LINK: "chainlink",
  XRP: "ripple",
  LTC: "litecoin",
  UNI: "uniswap",
  ATOM: "cosmos",
  XLM: "stellar",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tickers = searchParams.get("tickers");

    if (!tickers) {
      return NextResponse.json(
        { error: "Tickers parameter is required" },
        { status: 400 }
      );
    }

    const tickerList = tickers.split(",").map((t) => t.trim().toUpperCase());
    const cacheKey = `crypto-${tickerList.sort().join(",")}`;

    // Check cache
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ news: cached.data, cached: true });
    }

    // For now, return mock crypto news (can be replaced with real API later)
    // CoinGecko doesn't have a news endpoint, so we'd need CryptoPanic or similar
    const mockNews: NewsItem[] = generateMockCryptoNews(tickerList);

    // Update cache
    newsCache.set(cacheKey, { data: mockNews, timestamp: Date.now() });

    return NextResponse.json({ news: mockNews });
  } catch (error) {
    console.error("Failed to fetch crypto news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}

function generateMockCryptoNews(tickers: string[]): NewsItem[] {
  const now = Date.now();
  const news: NewsItem[] = [];

  // Generate relevant mock news based on the tickers
  const templates = [
    {
      title: "{ticker} shows strong momentum as market recovers",
      summary: "Cryptocurrency markets are showing signs of recovery with {name} leading the gains. Analysts point to increased institutional interest.",
    },
    {
      title: "{name} network upgrade announced for Q2",
      summary: "The {name} development team has announced a major network upgrade that promises improved scalability and lower transaction fees.",
    },
    {
      title: "Whale activity detected in {ticker} markets",
      summary: "On-chain data reveals significant accumulation of {name} by large holders, potentially signaling bullish sentiment.",
    },
    {
      title: "{name} adoption grows as major retailer accepts crypto payments",
      summary: "A Fortune 500 company has announced it will begin accepting {ticker} as payment, marking another milestone for mainstream adoption.",
    },
    {
      title: "DeFi protocols on {name} see record TVL",
      summary: "Total value locked in {name} DeFi protocols has reached new highs, demonstrating growing confidence in the ecosystem.",
    },
  ];

  const tickerNames: Record<string, string> = {
    BTC: "Bitcoin",
    ETH: "Ethereum",
    SOL: "Solana",
    MATIC: "Polygon",
    ADA: "Cardano",
    DOT: "Polkadot",
    DOGE: "Dogecoin",
    SHIB: "Shiba Inu",
    AVAX: "Avalanche",
    LINK: "Chainlink",
    XRP: "Ripple",
    LTC: "Litecoin",
  };

  // Generate 2 news items per ticker (up to 8 total)
  const tickersToUse = tickers.slice(0, 4);
  let newsId = 1;

  for (const ticker of tickersToUse) {
    const name = tickerNames[ticker] || ticker;
    const template = templates[newsId % templates.length];

    news.push({
      id: `crypto-news-${newsId++}`,
      title: template.title.replace("{ticker}", ticker).replace("{name}", name),
      summary: template.summary.replace("{ticker}", ticker).replace("{name}", name),
      source: ["CoinDesk", "CryptoNews", "Decrypt", "The Block"][newsId % 4],
      url: "#",
      imageUrl: null,
      publishedAt: new Date(now - newsId * 3600000).toISOString(),
      tickers: [ticker],
    });

    // Add second news item
    const template2 = templates[(newsId + 2) % templates.length];
    news.push({
      id: `crypto-news-${newsId++}`,
      title: template2.title.replace("{ticker}", ticker).replace("{name}", name),
      summary: template2.summary.replace("{ticker}", ticker).replace("{name}", name),
      source: ["CoinTelegraph", "Bitcoin Magazine", "DeFi Pulse", "Messari"][newsId % 4],
      url: "#",
      imageUrl: null,
      publishedAt: new Date(now - newsId * 7200000).toISOString(),
      tickers: [ticker],
    });
  }

  // Sort by date (newest first)
  news.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return news.slice(0, 8);
}
