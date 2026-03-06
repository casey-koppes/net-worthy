/**
 * Yahoo Finance utility functions for fetching stock and crypto prices
 * Used directly by API routes to avoid internal HTTP calls in serverless environments
 */

interface YahooHistoricalResponse {
  chart: {
    result: Array<{
      meta: {
        currency: string;
        symbol: string;
        regularMarketPrice?: number;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
        }>;
      };
    }>;
    error: null | { code: string; description: string };
  };
}

/**
 * Fetch current stock/crypto price from Yahoo Finance
 */
export async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    return price || null;
  } catch (error) {
    console.error(`Failed to fetch current price for ${ticker}:`, error);
    return null;
  }
}

/**
 * Fetch historical stock/crypto price from Yahoo Finance for a specific date
 */
export async function fetchHistoricalPrice(
  ticker: string,
  date: string
): Promise<number | null> {
  try {
    // Get a few days around the date to ensure we get data (markets may be closed)
    const targetDate = new Date(date);
    const startBuffer = new Date(targetDate);
    startBuffer.setDate(startBuffer.getDate() - 5);
    const endBuffer = new Date(targetDate);
    endBuffer.setDate(endBuffer.getDate() + 1);

    const period1 = Math.floor(startBuffer.getTime() / 1000);
    const period2 = Math.floor(endBuffer.getTime() / 1000);

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: YahooHistoricalResponse = await response.json();

    if (data.chart.error) {
      return null;
    }

    const result = data.chart.result?.[0];
    if (!result || !result.timestamp || result.timestamp.length === 0) {
      return null;
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const targetTimestamp = Math.floor(new Date(date).getTime() / 1000);

    // Find the closest date that's on or before the target
    let closestIndex = -1;
    let closestDiff = Infinity;

    for (let i = 0; i < timestamps.length; i++) {
      const diff = targetTimestamp - timestamps[i];
      if (diff >= 0 && diff < closestDiff && closes[i] !== null) {
        closestDiff = diff;
        closestIndex = i;
      }
    }

    // If no date on or before, find the closest date after
    if (closestIndex === -1) {
      for (let i = 0; i < timestamps.length; i++) {
        const diff = Math.abs(timestamps[i] - targetTimestamp);
        if (diff < closestDiff && closes[i] !== null) {
          closestDiff = diff;
          closestIndex = i;
        }
      }
    }

    if (closestIndex === -1) {
      return null;
    }

    return closes[closestIndex];
  } catch (error) {
    console.error(`Failed to fetch historical price for ${ticker}:`, error);
    return null;
  }
}

/**
 * Map crypto chain names to Yahoo Finance tickers
 */
export const cryptoTickerMap: Record<string, string> = {
  bitcoin: "BTC-USD",
  ethereum: "ETH-USD",
  solana: "SOL-USD",
  cardano: "ADA-USD",
  dogecoin: "DOGE-USD",
  polkadot: "DOT-USD",
  avalanche: "AVAX-USD",
  polygon: "MATIC-USD",
  chainlink: "LINK-USD",
  litecoin: "LTC-USD",
};
