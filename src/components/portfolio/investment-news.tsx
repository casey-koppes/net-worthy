"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Newspaper } from "lucide-react";

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

interface InvestmentNewsProps {
  tickers: string[];
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

export function InvestmentNews({ tickers }: InvestmentNewsProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tickers.length === 0) {
      setIsLoading(false);
      return;
    }

    fetchNews();
  }, [tickers]);

  async function fetchNews() {
    setIsLoading(true);
    setError(null);

    try {
      const tickerParam = tickers.join(",");
      const res = await fetch(`/api/stocks/news?tickers=${tickerParam}`);

      if (res.ok) {
        const data = await res.json();
        setNews(data.news || []);
      } else {
        setError("Failed to load news");
      }
    } catch (err) {
      console.error("Failed to fetch news:", err);
      setError("Failed to load news");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex gap-3">
            <div className="h-16 w-16 bg-muted rounded-md shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>{error}</p>
        <button
          onClick={fetchNews}
          className="text-sm text-primary hover:underline mt-2"
        >
          Try again
        </button>
      </div>
    );
  }

  if (tickers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Add investments with stock tickers to see related news</p>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No recent news found for your stocks</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {news.map((item) => (
        <a
          key={item.id}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
        >
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt=""
              className="h-16 w-16 rounded-md object-cover shrink-0"
            />
          ) : (
            <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Newspaper className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
              {item.title}
              <ExternalLink className="inline-block h-3 w-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
              {item.summary}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{item.source}</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(item.publishedAt)}
              </span>
              {item.tickers.length > 0 && (
                <>
                  <span className="text-xs text-muted-foreground">·</span>
                  <div className="flex gap-1">
                    {item.tickers.slice(0, 3).map((ticker) => (
                      <Badge
                        key={ticker}
                        variant="secondary"
                        className="text-[10px] px-1 py-0"
                      >
                        {ticker}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
