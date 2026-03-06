"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border overflow-hidden">
            <div className="h-40 bg-muted" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-1/2" />
              <div className="h-8 bg-muted rounded w-24 mt-2" />
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
        <Button variant="outline" size="sm" onClick={fetchNews} className="mt-2">
          Try again
        </Button>
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {news.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border overflow-hidden bg-card hover:shadow-md transition-shadow"
        >
          {/* Image Section */}
          <div className="relative h-40 bg-muted">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                <Newspaper className="h-12 w-12 text-muted-foreground/50" />
              </div>
            )}
            {/* Single Ticker Badge Overlay */}
            {item.tickers.length > 0 && (
              <div className="absolute top-2 left-2">
                <Badge className="bg-black/70 text-white hover:bg-black/80 text-xs">
                  {item.tickers[0]}
                </Badge>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-4">
            <h4 className="font-semibold text-sm line-clamp-2 mb-2">
              {item.title}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
              {item.summary}
            </p>

            {/* Meta Info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <span className="font-medium">{item.source}</span>
              <span>·</span>
              <span>{formatTimeAgo(item.publishedAt)}</span>
            </div>

            {/* View Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              asChild
            >
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                View Article
              </a>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
