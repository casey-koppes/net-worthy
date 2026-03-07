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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, Info, RefreshCw } from "lucide-react";
import { AssetNameInput } from "./asset-name-input";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";

export interface EditableAsset {
  id: string;
  name: string;
  description: string | null;
  value: number;
  category: string;
  isAsset: boolean;
  createdAt?: string;
  metadata?: {
    action?: string;
    investmentType?: string;
    ticker?: string;
    shares?: number;
    pricePerShare?: number;
    purchasePrice?: number;
  } | null;
}

interface EditAssetFormProps {
  asset: EditableAsset;
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Category options based on asset type
const ASSET_CATEGORIES = [
  { value: "bank", label: "Bank Account" },
  { value: "investment", label: "Investment" },
  { value: "vehicle", label: "Vehicle" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "real_estate", label: "Real Estate" },
  { value: "other", label: "Other" },
];

const LIABILITY_CATEGORIES = [
  { value: "mortgage", label: "Mortgage" },
  { value: "loan", label: "Loan" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" },
];

const INVESTMENT_CATEGORIES = [
  { value: "stock", label: "Stock" },
  { value: "401k", label: "401(k)" },
  { value: "roth", label: "Roth IRA" },
  { value: "ira", label: "Traditional IRA" },
  { value: "etf", label: "ETF" },
  { value: "mutual_fund", label: "Mutual Fund" },
  { value: "other", label: "Other" },
];

export function EditAssetForm({ asset, onSuccess, onCancel }: EditAssetFormProps) {
  const { dbUserId } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [stockPrice, setStockPrice] = useState<number | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toISOString().split("T")[0];
  };

  // Parse description to extract ticker and shares (for older records)
  const parseDescription = (description: string | null): { ticker: string | null; shares: number } => {
    if (!description) return { ticker: null, shares: 0 };
    const match = description.match(/^([A-Z]+)\s*-\s*(\d+(?:\.\d+)?)\s*shares?/i);
    if (match) {
      return { ticker: match[1].toUpperCase(), shares: parseFloat(match[2]) };
    }
    return { ticker: null, shares: 0 };
  };

  // Get ticker and shares from metadata or fallback to parsing description
  const parsedFromDescription = parseDescription(asset.description);
  const initialTicker = asset.metadata?.ticker || parsedFromDescription.ticker || "";
  const initialShares = asset.metadata?.shares?.toString() || (parsedFromDescription.shares > 0 ? parsedFromDescription.shares.toString() : "");

  const [formData, setFormData] = useState({
    name: asset.name,
    value: asset.value.toString(),
    description: asset.description || "",
    category: asset.category,
    action: asset.metadata?.action || "buy",
    shares: initialShares,
    activityDate: formatDateForInput(asset.createdAt),
    investmentType: asset.metadata?.investmentType || "stock",
    ticker: initialTicker,
  });

  // Auto-fetch stock price on modal load if ticker is present
  useEffect(() => {
    const tickerToFetch = asset.metadata?.ticker || parsedFromDescription.ticker;
    if (tickerToFetch && asset.category === "investment") {
      fetchStockPriceOnLoad(tickerToFetch);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchStockPriceOnLoad(ticker: string) {
    if (!ticker) return;
    setIsFetchingPrice(true);
    try {
      const res = await fetch(`/api/stocks/quote?ticker=${ticker}`);
      if (res.ok) {
        const data = await res.json();
        setStockPrice(data.price);
      }
    } catch (error) {
      console.error("Failed to fetch stock price:", error);
    } finally {
      setIsFetchingPrice(false);
    }
  }

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

  const categories = asset.isAsset ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    if (!formData.name || !formData.value) {
      toast.error("Name and value are required");
      return;
    }

    const value = parseFloat(formData.value);
    if (isNaN(value) || value < 0) {
      toast.error("Please enter a valid value");
      return;
    }

    setIsSubmitting(true);

    try {
      // Build updated metadata for investments
      const updatedMetadata = formData.category === "investment"
        ? {
            ...asset.metadata,
            action: formData.action,
            investmentType: formData.investmentType,
            ticker: formData.ticker || null,
            shares: formData.shares ? parseFloat(formData.shares) : null,
            pricePerShare: stockPrice || null,
          }
        : asset.metadata;

      const res = await fetch("/api/portfolio/manual-assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: asset.id,
          userId: dbUserId,
          name: formData.name,
          value: value,
          description: formData.description || null,
          category: formData.category,
          metadata: updatedMetadata,
          createdAt: formData.activityDate ? new Date(formData.activityDate).toISOString() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      toast.success("Updated successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!dbUserId) {
      toast.error("Please login first");
      return;
    }

    setIsDeleting(true);

    try {
      const res = await fetch(`/api/portfolio/manual-assets?assetId=${asset.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Deleted successfully!");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formData.category !== "investment" && (
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={formData.category}
            onValueChange={(value) => setFormData({ ...formData, category: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {formData.category === "investment" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="investmentType">Type</Label>
            <Select
              value={formData.investmentType}
              onValueChange={(value) => setFormData({ ...formData, investmentType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
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
            <Label htmlFor="name">Name *</Label>
            <AssetNameInput
              id="name"
              placeholder="Enter name"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ticker">Stock Ticker</Label>
              <Input
                id="ticker"
                placeholder="e.g., AAPL"
                value={formData.ticker}
                onChange={(e) => setFormData({ ...formData, ticker: e.target.value.toUpperCase() })}
                className="uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shares">Number of Shares</Label>
              <div className="flex gap-2">
                <Input
                  id="shares"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="e.g., 100"
                  value={formData.shares}
                  onChange={(e) => setFormData({ ...formData, shares: e.target.value })}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => fetchStockPrice(formData.ticker)}
                  disabled={!formData.ticker || isFetchingPrice}
                >
                  <RefreshCw className={`h-4 w-4 ${isFetchingPrice ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="action">Action</Label>
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

          {/* Market Price Banner - shown when stock price is available */}
          {stockPrice && (
            <div className="rounded-md bg-blue-50 border border-blue-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-800">Market price per share</span>
                <span className="text-sm font-semibold text-blue-800">
                  ${stockPrice.toFixed(2)}
                </span>
              </div>
              {formData.shares && parseFloat(formData.shares) > 0 && (
                <div className="flex items-center justify-between border-t border-blue-200 pt-2">
                  <span className="text-sm font-medium text-blue-800">Market Value ($)</span>
                  <span className="text-sm font-semibold text-blue-800">
                    ${(stockPrice * parseFloat(formData.shares)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

        </>
      )}

      {formData.category !== "investment" && (
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <AssetNameInput
            id="name"
            placeholder="Enter name"
            value={formData.name}
            onChange={(value) => setFormData({ ...formData, name: value })}
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label htmlFor="value">Value ($) *</Label>
          {formData.category === "investment" && (
            <span
              title="This is the actual price paid for the asset at the time of purchase."
              className="cursor-help"
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            $
          </span>
          <Input
            id="value"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            required
          />
        </div>
      </div>

      {/* View more toggle for investments */}
      {formData.category === "investment" && (
        <button
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-blue-600 text-sm font-medium hover:text-blue-700 hover:underline"
        >
          {showMore ? "view less" : "view more"}
        </button>
      )}

      {/* Additional fields shown when expanded (for investments) or always (for non-investments) */}
      {(formData.category !== "investment" || showMore) && (
        <>
          {formData.category === "investment" && (
            <div className="space-y-2">
              <Label htmlFor="activityDate">Purchase Date</Label>
              <Input
                id="activityDate"
                type="date"
                value={formData.activityDate}
                onChange={(e) => setFormData({ ...formData, activityDate: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                If set, the activity record will be sorted by this date
              </p>
            </div>
          )}

          {/* Cost Basis - only for Buy investments */}
          {formData.category === "investment" && formData.action === "buy" && (
            <div className="space-y-2">
              <Label>Cost Basis</Label>
              {(() => {
                const shares = parseFloat(formData.shares) || 0;
                const purchasePrice = parseFloat(formData.value) || 0;

                // Need shares, stock price, and purchase price to calculate
                if (shares <= 0 || !stockPrice || purchasePrice <= 0) {
                  return (
                    <div className="p-2 rounded-md bg-muted text-sm text-muted-foreground">
                      {!stockPrice ? "Fetch ticker to calculate cost basis" : "Enter Shares and Purchase Price to calculate"}
                    </div>
                  );
                }

                // Current market value from live stock price
                const currentMarketValue = stockPrice * shares;
                const gainLoss = currentMarketValue - purchasePrice;
                const percentChange = purchasePrice > 0
                  ? ((gainLoss / purchasePrice) * 100)
                  : 0;
                const isPositive = gainLoss >= 0;
                const isNegative = gainLoss < 0;

                const colorClass = isPositive ? "text-green-600" : "text-red-600";
                const bgClass = isPositive ? "bg-green-50" : "bg-red-50";
                const icon = isPositive ? "▲" : isNegative ? "▼" : "";
                const displayPercent = Math.abs(percentChange).toFixed(1).replace(/\.0$/, "");

                // Format dollar change
                const absAmount = Math.abs(gainLoss);
                let dollarDisplay: string;
                if (absAmount >= 1000000) {
                  dollarDisplay = `${(absAmount / 1000000).toFixed(2)}M`;
                } else if (absAmount >= 1000) {
                  dollarDisplay = `${(absAmount / 1000).toFixed(2)}K`;
                } else {
                  dollarDisplay = absAmount.toFixed(2);
                }
                const dollarChangeDisplay = gainLoss >= 0
                  ? `(+$${dollarDisplay})`
                  : `(-$${dollarDisplay})`;

                return (
                  <div className={`flex items-center gap-2 p-2 rounded-md ${bgClass}`}>
                    <span className={`inline-flex items-center font-medium ${colorClass}`}>
                      <span>{displayPercent}%</span>
                      {icon && <span>{icon}</span>}
                    </span>
                    <span className={`text-sm ${colorClass}`}>
                      {dollarChangeDisplay}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              placeholder="Additional notes"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
        </>
      )}

      <div className="flex gap-2 pt-2">
        <Button type="submit" className="flex-1" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="text-destructive border-destructive hover:bg-destructive/10"
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete &quot;{asset.name}&quot; from your portfolio.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}
