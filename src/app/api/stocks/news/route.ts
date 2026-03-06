import { NextRequest, NextResponse } from "next/server";

interface FinnhubNews {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

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
    const cacheKey = tickerList.sort().join(",");

    // Check cache
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json({ news: cached.data, cached: true });
    }

    const finnhubApiKey = process.env.FINNHUB_API_KEY;

    if (!finnhubApiKey) {
      // Return mock data if no API key
      const mockNews: NewsItem[] = [
        {
          id: "mock-1",
          title: "Market Update: Tech stocks show strong momentum",
          summary: "Technology sector continues to lead market gains as investors remain optimistic about AI growth.",
          source: "Financial Times",
          url: "#",
          imageUrl: null,
          publishedAt: new Date().toISOString(),
          tickers: tickerList.slice(0, 3),
        },
        {
          id: "mock-2",
          title: "Quarterly earnings exceed expectations",
          summary: "Several major companies report better-than-expected quarterly results, boosting investor confidence.",
          source: "Reuters",
          url: "#",
          imageUrl: null,
          publishedAt: new Date(Date.now() - 3600000).toISOString(),
          tickers: tickerList.slice(0, 2),
        },
      ];
      return NextResponse.json({ news: mockNews, mock: true });
    }

    // Fetch news for each ticker (limited to first 5 to avoid rate limits)
    const tickersToFetch = tickerList.slice(0, 5);
    const allNews: NewsItem[] = [];
    const seenIds = new Set<number>();

    for (const ticker of tickersToFetch) {
      try {
        const response = await fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${getDateString(-7)}&to=${getDateString(0)}&token=${finnhubApiKey}`
        );

        if (response.ok) {
          const data: FinnhubNews[] = await response.json();

          // Take first 3 news items per ticker
          for (const item of data.slice(0, 3)) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              allNews.push({
                id: item.id.toString(),
                title: item.headline,
                summary: item.summary,
                source: item.source,
                url: item.url,
                imageUrl: item.image || null,
                publishedAt: new Date(item.datetime * 1000).toISOString(),
                tickers: item.related.split(",").filter(Boolean),
              });
            }
          }
        }
      } catch (err) {
        console.error(`Failed to fetch news for ${ticker}:`, err);
      }
    }

    // Sort by date (newest first)
    allNews.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Limit to 10 news items
    const limitedNews = allNews.slice(0, 10);

    // Update cache
    newsCache.set(cacheKey, { data: limitedNews, timestamp: Date.now() });

    return NextResponse.json({ news: limitedNews });
  } catch (error) {
    console.error("Failed to fetch stock news:", error);
    return NextResponse.json(
      { error: "Failed to fetch news" },
      { status: 500 }
    );
  }
}

function getDateString(daysOffset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split("T")[0];
}
