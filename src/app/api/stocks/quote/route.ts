import { NextRequest, NextResponse } from "next/server";

// Fetch stock quote from Yahoo Finance (free, no API key required)
async function fetchYahooQuote(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

    return price || null;
  } catch (error) {
    console.error("Failed to fetch Yahoo quote:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
  }

  const price = await fetchYahooQuote(ticker.toUpperCase());

  if (price === null) {
    return NextResponse.json(
      { error: "Could not fetch quote for ticker" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ticker: ticker.toUpperCase(),
    price,
    currency: "USD",
    timestamp: new Date().toISOString(),
  });
}
