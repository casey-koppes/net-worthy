import { NextRequest, NextResponse } from "next/server";

interface YahooHistoricalResponse {
  chart: {
    result: Array<{
      meta: {
        currency: string;
        symbol: string;
      };
      timestamp: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
          open: (number | null)[];
          high: (number | null)[];
          low: (number | null)[];
        }>;
        adjclose?: Array<{
          adjclose: (number | null)[];
        }>;
      };
    }>;
    error: null | { code: string; description: string };
  };
}

/**
 * GET /api/stocks/historical
 * Fetches historical stock price from Yahoo Finance
 *
 * Query params:
 * - ticker: Stock symbol (e.g., AAPL)
 * - date: Target date (YYYY-MM-DD) - returns closing price for this date
 * - startDate: Start date for range (YYYY-MM-DD)
 * - endDate: End date for range (YYYY-MM-DD)
 *
 * If only `date` is provided, returns the closing price for that specific date.
 * If `startDate` and `endDate` are provided, returns prices for the range.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const date = searchParams.get("date");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  try {
    let period1: number;
    let period2: number;

    if (date) {
      // Single date query - get a few days around the date to ensure we get data
      const targetDate = new Date(date);
      const startBuffer = new Date(targetDate);
      startBuffer.setDate(startBuffer.getDate() - 5); // 5 days before
      const endBuffer = new Date(targetDate);
      endBuffer.setDate(endBuffer.getDate() + 1); // 1 day after

      period1 = Math.floor(startBuffer.getTime() / 1000);
      period2 = Math.floor(endBuffer.getTime() / 1000);
    } else if (startDate && endDate) {
      period1 = Math.floor(new Date(startDate).getTime() / 1000);
      period2 = Math.floor(new Date(endDate).getTime() / 1000);
    } else {
      return NextResponse.json(
        { error: "Either date or startDate/endDate is required" },
        { status: 400 }
      );
    }

    // Fetch from Yahoo Finance
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch stock data" },
        { status: response.status }
      );
    }

    const data: YahooHistoricalResponse = await response.json();

    if (data.chart.error) {
      return NextResponse.json(
        { error: data.chart.error.description },
        { status: 404 }
      );
    }

    const result = data.chart.result?.[0];
    if (!result || !result.timestamp || result.timestamp.length === 0) {
      return NextResponse.json(
        { error: "No historical data found for this ticker" },
        { status: 404 }
      );
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const currency = result.meta.currency;

    // If single date query, find the closest date
    if (date) {
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
        return NextResponse.json(
          { error: "No price data found for this date" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ticker: ticker.toUpperCase(),
        date: new Date(timestamps[closestIndex] * 1000)
          .toISOString()
          .split("T")[0],
        price: closes[closestIndex],
        currency,
      });
    }

    // Range query - return all prices
    const prices = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split("T")[0],
        price: closes[i],
      }))
      .filter((p) => p.price !== null);

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      currency,
      prices,
    });
  } catch (error) {
    console.error("Historical stock price error:", error);
    return NextResponse.json(
      { error: "Failed to fetch historical price" },
      { status: 500 }
    );
  }
}
