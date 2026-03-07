"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

interface AddInvestmentFormProps {
  onSuccess?: () => void;
}

const INVESTMENT_CATEGORIES = [
  { value: "stock", label: "Stock" },
  { value: "401k", label: "401(k)" },
  { value: "roth", label: "Roth IRA" },
  { value: "ira", label: "Traditional IRA" },
  { value: "etf", label: "ETF" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "other", label: "Other" },
];

export function AddInvestmentForm({ onSuccess }: AddInvestmentFormProps) {
  const { dbUserId } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [stockPrice, setStockPrice] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    action: "buy",
    category: "",
    name: "",
    shares: "",
    ticker: "",
    currentValue: "",
    description: "",
  });

  // Calculate value when shares or stock price changes
  useEffect(() => {
    if (stockPrice && formData.shares) {
      const shares = parseFloat(formData.shares);
      if (!isNaN(shares) && shares > 0) {
        const calculatedValue = (shares * stockPrice).toFixed(2);
        setFormData((prev) => ({ ...prev, currentValue: calculatedValue }));
      }
    }
  }, [stockPrice, formData.shares]);

  async function fetchStockPrice(ticker: string) {
    if (!ticker) return;

    setIsFetchingPrice(true);
    try {
      const res = await fetch(`/api/stocks/quote?ticker=${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setStockPrice(data.price);
        toast.success(`Found ${ticker.toUpperCase()} at $${data.price.toFixed(2)}`);
      } else {
        setStockPrice(null);
        toast.error(`Could not find ticker: ${ticker}`);
      }
    } catch (error) {
      setStockPrice(null);
      toast.error("Failed to fetch stock price");
    } finally {
      setIsFetchingPrice(false);
    }
  }

  function handleTickerBlur() {
    if (formData.ticker && formData.ticker.length >= 1) {
      fetchStockPrice(formData.ticker);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    if (!formData.name || !formData.category || !formData.currentValue) {
      toast.error("Please fill in all required fields");
      return;
    }

    const value = parseFloat(formData.currentValue);
    if (isNaN(value) || value < 0) {
      toast.error("Please enter a valid value");
      return;
    }

    setIsSubmitting(true);

    try {
      // Build description with investment details
      let description = formData.description || "";
      if (formData.ticker) {
        description = `${formData.ticker.toUpperCase()}${formData.shares ? ` - ${formData.shares} shares` : ""}${description ? ` - ${description}` : ""}`;
      }

      const res = await fetch("/api/portfolio/manual-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: dbUserId,
          category: "investment",
          name: formData.name,
          description: description || `${INVESTMENT_CATEGORIES.find(c => c.value === formData.category)?.label || formData.category}`,
          value: value,
          isAsset: true,
          // Store additional metadata
          metadata: {
            action: formData.action,
            investmentType: formData.category,
            ticker: formData.ticker || null,
            shares: formData.shares ? parseFloat(formData.shares) : null,
            pricePerShare: stockPrice,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add investment");
      }

      toast.success("Investment added successfully!");
      setFormData({
        action: "buy",
        category: "",
        name: "",
        shares: "",
        ticker: "",
        currentValue: "",
        description: "",
      });
      setStockPrice(null);
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add investment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="category">Category *</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {INVESTMENT_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="action">Action *</Label>
          <Select
            value={formData.action}
            onValueChange={(value) => setFormData({ ...formData, action: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Apple Stock, Company 401k"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ticker">Stock Ticker</Label>
          <div className="flex gap-2">
            <Input
              id="ticker"
              placeholder="e.g., AAPL"
              value={formData.ticker}
              onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
              onBlur={handleTickerBlur}
              className="uppercase"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fetchStockPrice(formData.ticker)}
              disabled={!formData.ticker || isFetchingPrice}
            >
              {isFetchingPrice ? "..." : "Fetch"}
            </Button>
          </div>
          {stockPrice && (
            <p className="text-sm text-muted-foreground">
              Current price: ${stockPrice.toFixed(2)}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="shares">Number of Shares</Label>
          <Input
            id="shares"
            type="number"
            step="0.0001"
            min="0"
            placeholder="e.g., 100"
            value={formData.shares}
            onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currentValue">
          Current Value ($) *
          {stockPrice && formData.shares && (
            <span className="text-muted-foreground font-normal ml-2">
              (auto-calculated from shares x price)
            </span>
          )}
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="currentValue"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            value={formData.currentValue}
            onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <textarea
          id="description"
          placeholder="Additional notes about this investment"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Adding..." : "Add Investment"}
      </Button>
    </form>
  );
}
